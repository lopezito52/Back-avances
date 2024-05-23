require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const morgan = require("morgan");
const { db } = require("./firebase");
const { v4: uuidv4 } = require("uuid");
const admin = require('firebase-admin'); 

const app = express();

const PORT = process.env.PORT || 3000;

const listUserAdmin = [{ email: "admin@admin.com", password: "admin" }];
let refreshTokens = [];

app.use(express.json());
app.use(cors());
app.use(morgan("dev"));

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

app.get("/", (req, res) => {
  res.send("Hola");
});

app.get('/users', async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    // Check if the required fields are present
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).send("Missing required fields");
    }

    const user = {
      firstName,
      lastName,
      email,
      password, // Guardando la contraseña como texto plano (inseguro)
    };

    const userRef = await db.collection("contacts").add(user);
    const userId = userRef.id;
    console.log("User ID:", userId);
    res.status(201).send({ userId });
  } catch (error) {
    console.error("Error creating user:", error.message);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/users/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).send("Missing email or password");
  }

  try {
    const snapshot = await db.collection("contacts").where("email", "==", email).get();

    if (snapshot.empty) {
      return res.status(400).send("Cannot find user");
    }

    let user;
    snapshot.forEach((doc) => {
      user = doc.data();
      user.id = doc.id;
    });

    if (password === user.password) {
      const accessToken = generateAccessToken({ email: user.email });
      const refreshToken = jwt.sign({ email: user.email }, process.env.REFRESH_TOKEN_SECRET);
      refreshTokens.push(refreshToken);
      res.cookie("session", refreshToken, {
        httpOnly: true,
        secure: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      res.json({ accessToken, refreshToken, userId: user.id, userName: `${user.firstName} ${user.lastName}` });
    } else {
      res.status(403).send("Not allowed");
    }
  } catch (error) {
    console.error("Error logging in:", error.message);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/edit-contact/:id", async (req, res) => {
  try {
    const doc = await db.collection("contacts").doc(req.params.id).get();
    if (!doc.exists) {
      return res.status(404).send("Contact not found");
    }
    const contact = { id: doc.id, ...doc.data() };
    res.json(contact);
  } catch (error) {
    console.error("Error retrieving contact:", error.message);
    res.status(500).send("Internal Server Error");
  }
});

app.delete("/delete-contact/:id", authenticateToken, async (req, res) => {
  try {
    await db.collection("contacts").doc(req.params.id).delete();
    res.send("Contact deleted");
  } catch (error) {
    console.error("Error deleting contact:", error.message);
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
  const user = listUserAdmin.find(user => user.email === email && user.password === password);

  if (!user) {
    return res.status(401).json({ message: "Correo electrónico o contraseña incorrectos" });
  }

  try {
    const accessToken = generateAccessToken({ email: user.email });
    const refreshToken = jwt.sign({ email: user.email }, process.env.REFRESH_TOKEN_SECRET);
    refreshTokens.push(refreshToken);
    res.cookie("session", refreshToken, {
      httpOnly: true,
      secure: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.json({ accessToken, refreshToken });
  } catch (error) {
    console.error("Error al generar tokens:", error.message);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

app.post("/tweets", async (req, res) => {
  const { userId, userName, tweet } = req.body;

  console.log('Request received with body:', req.body);

  if (!userId || !userName || !tweet) {
    console.log('Missing required fields:', { userId, userName, tweet });
    return res.status(400).send('Missing required fields');
  }

  try {
    const userRef = db.collection('contacts').doc(userId);
    const doc = await userRef.get();

    if (!doc.exists) {
      console.log('User not found:', userId);
      return res.status(404).send('User not found');
    }

    const tweetData = {
      userId,
      userName,
      tweet,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    };
    
    const tweetRef = await db.collection('tweets').add(tweetData);
    
    await userRef.update({
      tweets: admin.firestore.FieldValue.arrayUnion({
        tweetId: tweetRef.id,
        tweet: tweet,
        timestamp: tweetData.timestamp
      })
    });
    

    res.status(201).send('Tweet added successfully');
  } catch (error) {
    console.error('Error posting tweet:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/tweets', async (req, res) => {
  try {
    const snapshot = await db.collection('tweets').orderBy('timestamp', 'desc').get();
    const tweets = [];
    snapshot.forEach(doc => {
      const tweetData = doc.data();
      tweetData.id = doc.id;
      tweets.push(tweetData);
    });
    res.json(tweets);
  } catch (error) {
    console.error('Error retrieving tweets:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get("/tweets/:id", async (req, res) => {
  const userId = req.params.id;

  try {
    const snapshot = await db.collection('tweets').where('userId', '==', userId).get();
    const tweets = [];

    snapshot.forEach(doc => {
      const tweetData = doc.data();
      tweetData.id = doc.id;
      tweets.push(tweetData);
    });

    res.json(tweets);
  } catch (error) {
    console.error('Error retrieving user tweets:', error);
    res.status(500).send('Internal Server Error');
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
}
