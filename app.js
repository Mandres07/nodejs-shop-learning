const path = require('path');

const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);
const csrf = require('csurf'); // Para tokens de seguridad en cada form como antiforgery token
const flash = require('connect-flash');
const multer = require('multer');

const errorController = require('./controllers/error');
const User = require('./models/user');

const MONGODB_URI = 'mongodb+srv://Mandres:Mandres.07.mdb@cluster0.qnd1j.mongodb.net/shop';

const app = express();
const store = new MongoDBStore({
   uri: MONGODB_URI,
   collection: 'sessions'
});

const csrfProtection = csrf();

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
      console.log('Connected!');
      app.listen(3000);
   })
   .catch(err => {
      console.log(err);
   });
