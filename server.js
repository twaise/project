require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const axios = require('axios');
const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
const qr = require('qr-image');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const dbUri = 'mongodb://localhost:27017/web';
mongoose.connect(dbUri, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.log('MongoDB connection error:', err));

const OPENWEATHER_API_KEY = '1b57d3ac964058f67a2964a78c1a705a';
const NEWS_API_KEY = 'e2c85a43c3f14b2b935e174301518158';
const OPENCAGE_API_KEY = '911f8d45c75b4dee854e28aa65664000';

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'auth.html'));
});

app.post('/Calculate-BMI', (req, res) => {
    const { weight, height } = req.body;
    if (!weight || !height || weight <= 0 || height <= 0) {
        return res.send("Please enter valid weight and height!");
    }
    const bmi = (weight / (height * height)).toFixed(2);
    let category = bmi < 18.5 ? 'underweight' : bmi < 24.9 ? 'normal weight' : bmi < 29.9 ? 'overweight' : 'obesity';
    res.send(`<h2>Ваш ИМТ: ${bmi}</h2><p>Категория: ${category}</p><a href="/bmi.html">Вернуться</a>`);
});

const transporter = nodemailer.createTransport({
    service: 'outlook',
    auth: { user: '231356@astanait.edu.kz', pass: '2005' }
});

app.post('/send-email', (req, res) => {
    const mailOptions = {
        from: '231356@astanait.edu.kz',
        to: 'gasters684@gmail.com',
        subject: 'privet',
        text: 'poka',
        attachments: [{ filename: 'example.txt', content: 'Текстовый файл прикреплен.' }]
    };
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            return res.status(500).send(error.toString());
        }
        res.status(200).send('Email sent: ' + info.response);
    });
});

app.get('/weather', async (req, res) => {
    const city = req.query.city;
    try {
        const weather = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${city}&units=metric&appid=${OPENWEATHER_API_KEY}`);
        const news = await axios.get(`https://newsapi.org/v2/everything?q=${city}&apiKey=${NEWS_API_KEY}`);
        const geocode = await axios.get(`https://api.opencagedata.com/geocode/v1/json?q=${city}&key=${OPENCAGE_API_KEY}`);
        res.json({ weather: weather.data, news: news.data.articles.slice(0, 5), geocode: geocode.data.results[0].geometry });
    } catch (error) {
        res.status(500).send('Error fetching data');
    }
});

const connectDB = async () => {
    const client = await MongoClient.connect('mongodb://localhost:27017', { useNewUrlParser: true, useUnifiedTopology: true });
    return client.db('blogDB');
};

app.post('/api/blogs', async (req, res) => {
    const db = await connectDB();
    const result = await db.collection('blogs').insertOne({ ...req.body, createdAt: new Date() });
    res.status(201).json(result);
});

app.get('/api/blogs', async (req, res) => {
    const db = await connectDB();
    const blogs = await db.collection('blogs').find().toArray();
    res.json(blogs);
});

app.delete('/api/blogs/:id', async (req, res) => {
    const db = await connectDB();
    const result = await db.collection('blogs').deleteOne({ _id: new ObjectId(req.params.id) });
    res.json(result);
});

const User = mongoose.model('User', new mongoose.Schema({
    username: String,
    email: String,
    password: String
}));

app.post('/api/auth/register', async (req, res) => {
    const user = new User(req.body);
    await user.save();
    res.status(201).send('Registration successful');
});

app.post('/api/auth/login', async (req, res) => {
    const user = await User.findOne({ email: req.body.email });
    if (user && user.password === req.body.password) {
        res.status(200).send('Login successful');
    } else {
        res.status(401).send('Invalid email or password');
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});


app.post('/generate-qr', (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).send('URL не указан');

    const qrCode = qr.image(url, { type: 'png' });
    const filePath = path.join(__dirname, 'public', 'qr.png');
    const writeStream = fs.createWriteStream(filePath);

    qrCode.pipe(writeStream);

    writeStream.on('finish', () => {
        res.json({ message: 'QR-код создан', url: '/qr.png' });
    });

    writeStream.on('error', (err) => {
        res.status(500).send('Ошибка сохранения QR-кода');
    });
});
