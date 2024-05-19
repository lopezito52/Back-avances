require("dotenv").config();
const express = require("express");
const bcrypt = require("bcrypt");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const morgan = require("morgan");
const { db } = require("./firebase");

const app = express();
const saltRounds = 10;
const PORT = process.env.PORT || 3000;

const listUserAdmin = [{ email: "admin@admin.com", password: "admin" }];
let refreshTokens = [];

app.use(express.json());
app.use(cors());
app.use(morgan("dev"));

const users = [];

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

app.get("/", (req, res) => {
  res.send("Hola");
});

app.get("/users",async (req, res) => {
  try {
    const snapshot = await db.collection("contacts").get();
    const users = [];
    snapshot.forEach((doc) => {
      const userData = doc.data();
      userData.id = doc.id;
      users.push(userData);
    });
    res.json(users);
  } catch (error) {
    console.error("Error retrieving users:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/users", async (req, res) => {
  try {
    const salt = await bcrypt.genSalt(saltRounds);
    const hashedPassword = await bcrypt.hash(req.body.password, salt);
    const user = {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      email: req.body.email,
      password: hashedPassword,
    };
    const userRef = await db.collection("contacts").add(user);
    const userId = userRef.id;
    console.log("User ID:", userId);
    users.push(user);
    res.status(201).send();
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/users/login", authenticateToken, async (req, res) => {
  const user = users.find((user) => user.email === req.body.email);
  if (!user) {
    return res.status(400).send("Cannot find user");
  }
  try {
    if (await bcrypt.compare(req.body.password, user.password)) {
      res.send("Success");
    } else {
      res.send("Not allowed");
    }
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/edit-contact/:id", async (req, res) => {
  try {
    const doc = await db.collection("contacts").doc(req.params.id).get();
    if (!doc.exists) {
      return res.status(404).send("Contact not found");
    }
    const contact = {
      id: doc.id,
      ...doc.data(),
    };
    res.json(contact);
  } catch (error) {
    console.error("Error retrieving contact:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/delete-contact/:id", authenticateToken, async (req, res) => {
  try {
    await db.collection("contacts").doc(req.params.id).delete();
    res.send("Contact deleted");
  } catch (error) {
    console.error("Error deleting contact:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/token", (req, res) => {
  const refreshToken = req.body.token;
  if (!refreshToken) return res.sendStatus(401);
  if (!refreshTokens.includes(refreshToken)) return res.sendStatus(403);
  jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    const accessToken = generateAccessToken({ email: user.email });
    res.json({ accessToken });
  });
});

app.delete("/logout", (req, res) => {
  const refreshToken = req.body.token;
  if (!refreshToken) return res.sendStatus(400);
  refreshTokens = refreshTokens.filter((token) => token !== refreshToken);
  res.clearCookie("session");
  res.sendStatus(204);
});

app.post("/login", (req, res) => {
  const { email, password } = req.body;
  const user = listUserAdmin.find(
    (user) => user.email === email && user.password === password
  );

  if (!user) {
    return res
      .status(401)
      .json({ message: "Correo electrónico o contraseña incorrectos" });
  }

  try {
    const accessToken = generateAccessToken({ email: user.email });
    const refreshToken = jwt.sign(
      { email: user.email },
      process.env.REFRESH_TOKEN_SECRET
    );
    refreshTokens.push(refreshToken);
    res.cookie("session", refreshToken, {
      httpOnly: true,
      secure: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.json({ accessToken, refreshToken });
  } catch (error) {
    console.error("Error al generar tokens:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

function generateAccessToken(user) {
  return jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "15m" });
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
  // Ruta para publicar tweets
app.post('/tweets', async (req, res) => {
    const { userId, tweet } = req.body;

    try {
        // Encuentra al usuario por su ID
        const userRef = db.collection('contacts').doc(userId);
        const doc = await userRef.get();

        if (!doc.exists) {
            return res.status(404).send('User not found');
        }

        // Actualiza el documento del usuario con el nuevo tweet
        await userRef.update({
            tweets: admin.firestore.FieldValue.arrayUnion(tweet)
        });

        res.status(201).send('Tweet added successfully');
    } catch (error) {
        console.error('Error posting tweet:', error);
        res.status(500).send('Internal Server Error');
    }
});
}