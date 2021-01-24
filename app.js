const path = require('path');
const fs = require('fs');
// const https = require('https');

const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);
const csrf = require('csurf'); // Para tokens de seguridad en cada form como antiforgery token
const flash = require('connect-flash');
const multer = require('multer');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');

const errorController = require('./controllers/error');
const User = require('./models/user');

const MONGODB_URI = `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}@cluster0.qnd1j.mongodb.net/${process.env.MONGO_DEFAULT_DB}`;

const app = express();
const store = new MongoDBStore({
   uri: MONGODB_URI,
   collection: 'sessions'
});

const csrfProtection = csrf();

//obtener el certificado SSL
// const privateKey = fs.readFileSync('server.key');
// const certificate = fs.readFileSync('server.cert');

// Configuracion de multer que indica en q carpeta se guardar los archivos y con que nombre
const fileStorage = multer.diskStorage({
   destination: (req, file, cb) => {
      cb(null, 'images');
   },
   filename: (req, file, cb) => {
      cb(null, new Date().getFullYear().toString() + '-' + file.originalname);
   }
});

const fileFilter = (req, file, cb) => {
   if (file.mimetype === 'image/png' || file.mimetype === 'image/jpg' || file.mimetype === 'image/jpeg') {
      cb(null, true);
   }
   else {
      cb(null, false);
   }
};

app.set('view engine', 'ejs');
app.set('views', 'views');

const adminRoutes = require('./routes/admin');
const shopRoutes = require('./routes/shop');
const authRoutes = require('./routes/auth');

// Stream que se va a utilizar para guardar todos los logs del server
const accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), { flags: 'a' });

// Este middleware incrusta algunos headers al request para agregarle seguridad al sitio y servidor en general, procurar incrustar los headers antes de enviar responses
app.use(helmet());
// Este middleware ayuda a comprimir todos los archivos del sitio para que pesen mucho menos y el server responda mas rapido
app.use(compression());
// Middleware que loggea cada accion que se hace en el server y lo escribe en el stream especificado (si no se especifica stream lo escribe en consola)
app.use(morgan('combined', { stream: accessLogStream }));

app.use(bodyParser.urlencoded({ extended: false }));

// multer permite parsear archivos enviados desde los forms pero al usr .single('image') indicamos que solo es un archivo y el input se llama image
app.use(multer({ storage: fileStorage, fileFilter: fileFilter }).single('image')); // la configuracion storage indica donde y con que nombre se guardar los archivos

app.use(express.static(path.join(__dirname, 'public')));
app.use('/images', express.static(path.join(__dirname, 'images')));
app.use(session({
   secret: 'my secret',
   resave: false,
   saveUninitialized: false,
   store: store
}));

app.use(csrfProtection);
app.use(flash());

app.use((req, res, next) => {
   res.locals.isAuthenticated = req.session.isLoggedIn; // declara una variable que se puede acceder localmente en todos los views
   res.locals.csrfToken = req.csrfToken();
   next();
});

app.use((req, res, next) => {
   if (!req.session.user) {
      return next();
   }
   User.findById(req.session.user._id)
      .then(user => {
         if (!user) {
            return next();
         }
         req.user = user;
         next();
      })
      .catch(err => {
         next(new Error(err)); // dentro de codico asyncrono se llaman los errores con el next(error) mientras que en codigo normal solo con throw funciona
      });
});

app.use('/admin', adminRoutes);
app.use(shopRoutes);
app.use(authRoutes);

app.get('/500', errorController.get500);

app.use(errorController.get404);

// Middleware de errores, es el unico que contiene 4 parametros siendo el error el primero y el resto req, res y next
app.use((error, req, res, next) => {
   res.status(500).render('500', {
      pageTitle: 'Error',
      path: '/500',
      isAuthenticated: req.session.isLoggedIn
   });
});

mongoose
   .connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
   .then(result => {
      // console.log('Connected!');
      // con esta fora se crea el server https
      // https.createServer({ key: privateKey, cert: certificate }, app).listen(process.env.PORT || 3000)
      // con esta forma se crea el server http
      app.listen(process.env.PORT || 3000);
   })
   .catch(err => {
      console.log(err);
   });
