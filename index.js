const express = require('express');
const app = express();
const bcrypt = require('bcrypt');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const morgan = require('morgan')
const {db} = require('./firebase')

app.use(express.json());
app.use(cors());
app.use(morgan('dev'));

require('./firebase')

const users = [];


console.log('Server running in port 3000')

app.get('/',  (req, res) => {
    res.send('Hola');
});


app.get('/users', async (req, res) => {
    try {
        const snapshot = await db.collection('contacts').get();
        const users = [];
        snapshot.forEach(doc => {

            const userData = doc.data();
            userData.id = doc.id;

            users.push(userData);
        });
       
        res.json(users);
    } catch (error) {
        console.error('Error retrieving users:', error);
        res.status(500).send('Internal Server Error');
    }
});



app.post('/users', async (req, res) => {
    try {
        const salt = await bcrypt.genSalt();
        const hashedPassword = await bcrypt.hash(req.body.password, salt);
        console.log(salt);
        console.log(hashedPassword);
        const user = {
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            email: req.body.email,
            password: hashedPassword
        };
        await db.collection('contacts').add({
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            email: req.body.email,
            password: req.body.password,
        }); 
        const userId = userRef.id;
        console.log('User ID:', userId);
        users.push(user);
        res.status(201).send();
    } catch {
        res.status(500).send();
    }
});

app.post('/users/login', async (req, res) => {
    const user = users.find(user => user.email === req.body.email);
    if (user == null) {
        return res.status(400).send('Cannot find user');
    }
    try {
        if (await bcrypt.compare(req.body.password, user.password)) {
            res.send('Success');
        } else {
            res.send('Not allowed');
        }
    } catch {
        res.status(500).send();
    }
});

app.get('/edit-contact/:id', async (req, res) => {
  try {
      const doc = await db.collection("contacts").doc(req.params.id).get();
    if (!doc.exists) {
      return res.status(404).send('Contact not found');
        }
          const contact = {
           id: doc.id,
        ...doc.data(),
    };
    res.json(contact);
} catch (error) {
    console.error('Error retrieving contact:', error);
    res.status(500).send('Internal Server Error');
}
});

app.get('/delete-contact/:id', async (req, res) => {

await db.collection('contacts').doc(req.params.id).delete();
res.send('contact deleted');

})





app.listen(3000);