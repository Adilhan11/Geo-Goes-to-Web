const express = require("express");
const multer = require("multer");
const bodyParser = require("body-parser");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const sql = require("mssql");
const path = require("path");
const config = require("./config");
const port = 3000;

// Multer storage konfigürasyonu
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        // Orijinal dosya adını ve uzantısını koru
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileExt = path.extname(file.originalname);
        cb(null, `image-${uniqueSuffix}${fileExt}`);
    }
});

const upload = multer({ storage: storage });

const app = express();

// CORS ayarlarını güncelle
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Disposition']
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Statik dosya servis ayarını güncelle
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
    setHeaders: (res, filepath) => {
        // Dosya uzantısına göre Content-Type ayarla
        const ext = path.extname(filepath).toLowerCase();
        switch (ext) {
            case '.jpg':
            case '.jpeg':
                res.setHeader('Content-Type', 'image/jpeg');
                break;
            case '.png':
                res.setHeader('Content-Type', 'image/png');
                break;
            case '.gif':
                res.setHeader('Content-Type', 'image/gif');
                break;
            default:
                res.setHeader('Content-Type', 'application/octet-stream');
        }
        res.setHeader('Content-Disposition', 'inline');
        res.setHeader('Access-Control-Allow-Origin', '*');
    }
}));

const JWT_SECRET = "fenerbahce"; // Güvenli bir anahtar belirleyin

// Yetkilendirme middleware
function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ message: "Authorization header missing" });
    }

    const token = authHeader.split(" ")[1];
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: "Invalid token" });
        }
        console.log("Decoded Token:", user);
        req.user = user;
        next();
    });
    
}

// Kullanıcı rollerini kontrol eden middleware
function authorizeRoles(...allowedRoles) {
    return (req, res, next) => {
        console.log("User Role in Request:", req.user.role); // Rolü loglayın
        const userRole = req.user.role;
        if (!allowedRoles.includes(userRole)) {
            return res.status(403).json({ message: "Unauthorized access" });
        }
        next();
    };
}
// Veritabanına bağlanma
sql.connect(config)
    .then((pool) => {
        console.log("Connected to MSSQL");

        // Kullanıcı kayıt
        app.post("/register", async (req, res) => {
            const { username, password, role_id } = req.body;
            const hashedPassword = await bcrypt.hash(password, 10);

            try {
                await pool
                    .request()
                    .input("username", sql.NVarChar, username)
                    .input("password", sql.NVarChar, hashedPassword)
                    .input("role_id", sql.Int, role_id)
                    .query("INSERT INTO users (username, password, role_id) VALUES (@username, @password, @role_id)");
                res.status(201).json({ message: "User registered successfully!" });
            } catch (error) {
                console.error("Error registering user:", error);
                res.status(500).json({ message: "Error registering user" });
            }
        });

        // Kullanıcı giriş
        app.post("/login", async (req, res) => {
            const { username, password } = req.body;

            try {
                const result = await pool
                    .request()
                    .input("username", sql.NVarChar, username)
                    .query("SELECT * FROM users WHERE username = @username");

                const user = result.recordset[0];
                if (!user) {
                    return res.status(401).json({ message: "Invalid username or password" });
                }

                const isPasswordValid = await bcrypt.compare(password, user.password);
                if (!isPasswordValid) {
                    return res.status(401).json({ message: "Invalid username or password" });
                }

                const token = jwt.sign(
                    { userId: user.id, username: user.username, role: user.role_id },
                    JWT_SECRET,
                    { expiresIn: "1h" }
                );

                res.status(200).json({ token });
            } catch (error) {
                console.error("Error during login:", error);
                res.status(500).json({ message: "Error during login" });
            }
        });

        // CRUD işlemlerine yetkilendirme ekleme
        app.post("/api/points", authenticate, upload.single("image"), async (req, res) => {
            const { latitude, longitude, description } = req.body;
            const image_url = req.file ? req.file.path : null;

            try {
                const result = await pool
                    .request()
                    .input("latitude", sql.Float, latitude)
                    .input("longitude", sql.Float, longitude)
                    .input("description", sql.NVarChar, description)
                    .input("image_url", sql.NVarChar, image_url)
                    .query(
                        "INSERT INTO points (latitude, longitude, description, image_url) VALUES (@latitude, @longitude, @description, @image_url)"
                    );

                res.status(201).json({ message: "Point added successfully!", result });
            } catch (error) {
                console.error("Error saving point:", error);
                res.status(500).json({ message: "Error saving point" });
            }
        });

        app.get("/api/points", authenticate, async (req, res) => {
            try {
                const result = await pool.request().query("SELECT * FROM points");
                res.status(200).json(result.recordset);
            } catch (error) {
                console.error("Error fetching points:", error);
                res.status(500).json({ message: "Error fetching points" });
            }
        });

        app.put("/api/points/:id", authenticate, authorizeRoles(1), upload.single("image"), async (req, res) => {
            const { id } = req.params;
            const { description, latitude, longitude } = req.body;
            const image_url = req.file ? req.file.path : null;
        
            try {
                let updateQuery;
                let request = pool.request()
                    .input("id", sql.Int, id)
                    .input("description", sql.NVarChar, description)
                    .input("latitude", sql.Float, latitude)
                    .input("longitude", sql.Float, longitude);
        
                if (image_url) {
                    // Eğer yeni resim yüklendiyse, image_url'i güncelle
                    updateQuery = `
                        UPDATE points 
                        SET description = @description, 
                            latitude = @latitude, 
                            longitude = @longitude, 
                            image_url = @image_url 
                        WHERE id = @id
                    `;
                    request.input("image_url", sql.NVarChar, image_url);
                } else {
                    // Resim yüklenmediyse, mevcut resmi koru
                    updateQuery = `
                        UPDATE points 
                        SET description = @description, 
                            latitude = @latitude, 
                            longitude = @longitude 
                        WHERE id = @id
                    `;
                }
        
                const result = await request.query(updateQuery);
        
                if (result.rowsAffected[0] === 0) {
                    return res.status(404).json({ message: "Point not found." });
                }
        
                res.status(200).json({ 
                    message: "Point updated successfully!",
                    image_url: image_url // Yeni resim URL'ini dön
                });
            } catch (error) {
                console.error("Error updating point:", error);
                res.status(500).json({ message: "Error updating point" });
            }
        });
        

        app.delete("/api/points/:id", authenticate, authorizeRoles(1,2), async (req, res) => {
            const { id } = req.params;
        
            try {
                const result = await pool
                    .request()
                    .input("id", sql.Int, id)
                    .query("DELETE FROM points WHERE id = @id");
        
                if (result.rowsAffected[0] === 0) {
                    return res.status(404).json({ message: "Point not found." });
                }
        
                res.status(200).json({ message: "Point deleted successfully!" });
            } catch (error) {
                console.error("Error deleting point:", error);
                res.status(500).json({ message: "Error deleting point" });
            }
        });
        

        // GeoJSON dışa aktarma rotası
        app.get("/api/points/geojson", authenticate,authorizeRoles(1), async (req, res) => {
            try {
                const result = await pool.request().query("SELECT * FROM points");

                const geojson = {
                    type: "FeatureCollection",
                    features: result.recordset.map((point) => ({
                        type: "Feature",
                        geometry: {
                            type: "Point",
                            coordinates: [parseFloat(point.longitude), parseFloat(point.latitude)],
                        },
                        properties: {
                            id: point.id,
                            description: point.description,
                            image_url: point.image_url,
                        },
                    })),
                };

                res.status(200).json(geojson);
            } catch (error) {
                console.error("Error exporting GeoJSON:", error);
                res.status(500).json({ message: "Error exporting GeoJSON" });
            }
        });

        // New endpoints for lines
        app.post("/api/lines", authenticate, async (req, res) => {
            const { name, coordinates, style } = req.body;

            try {
                const result = await pool
                    .request()
                    .input("name", sql.NVarChar, name)
                    .input("coordinates", sql.NVarChar, JSON.stringify(coordinates))
                    .input("style", sql.NVarChar, JSON.stringify(style))
                    .query(
                        "INSERT INTO lines (name, coordinates, style) VALUES (@name, @coordinates, @style)"
                    );

                res.status(201).json({ message: "Line added successfully!", result });
            } catch (error) {
                console.error("Error saving line:", error);
                res.status(500).json({ message: "Error saving line" });
            }
        });

        app.get("/api/lines", authenticate, async (req, res) => {
            try {
                const result = await pool.request().query("SELECT * FROM lines");
                res.status(200).json(result.recordset);
            } catch (error) {
                console.error("Error fetching lines:", error);
                res.status(500).json({ message: "Error fetching lines" });
            }
        });

        // New endpoints for polygons
        app.post("/api/polygons", authenticate, async (req, res) => {
            const { name, coordinates, style } = req.body;

            try {
                const result = await pool
                    .request()
                    .input("name", sql.NVarChar, name)
                    .input("coordinates", sql.NVarChar, JSON.stringify(coordinates))
                    .input("style", sql.NVarChar, JSON.stringify(style))
                    .query(
                        "INSERT INTO polygons (name, coordinates, style) VALUES (@name, @coordinates, @style)"
                    );

                res.status(201).json({ message: "Polygon added successfully!", result });
            } catch (error) {
                console.error("Error saving polygon:", error);
                res.status(500).json({ message: "Error saving polygon" });
            }
        });

        app.get("/api/polygons", authenticate, async (req, res) => {
            try {
                const result = await pool.request().query("SELECT * FROM polygons");
                res.status(200).json(result.recordset);
            } catch (error) {
                console.error("Error fetching polygons:", error);
                res.status(500).json({ message: "Error fetching polygons" });
            }
        });

        // Delete endpoints for lines and polygons
        app.delete("/api/lines/:id", authenticate, authorizeRoles(1, 2), async (req, res) => {
            const { id } = req.params;

            try {
                const result = await pool
                    .request()
                    .input("id", sql.Int, id)
                    .query("DELETE FROM lines WHERE id = @id");

                if (result.rowsAffected[0] === 0) {
                    return res.status(404).json({ message: "Line not found." });
                }

                res.status(200).json({ message: "Line deleted successfully!" });
            } catch (error) {
                console.error("Error deleting line:", error);
                res.status(500).json({ message: "Error deleting line" });
            }
        });

        app.delete("/api/polygons/:id", authenticate, authorizeRoles(1, 2), async (req, res) => {
            const { id } = req.params;

            try {
                const result = await pool
                    .request()
                    .input("id", sql.Int, id)
                    .query("DELETE FROM polygons WHERE id = @id");

                if (result.rowsAffected[0] === 0) {
                    return res.status(404).json({ message: "Polygon not found." });
                }

                res.status(200).json({ message: "Polygon deleted successfully!" });
            } catch (error) {
                console.error("Error deleting polygon:", error);
                res.status(500).json({ message: "Error deleting polygon" });
            }
        });

        app.listen(port, () => {
            console.log(`Server running on http://localhost:${port}`);
        });
    })
    .catch((err) => {
        console.error("Database connection failed", err);
    });
