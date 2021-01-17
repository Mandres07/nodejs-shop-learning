const bcrypt = require('bcryptjs');  // Para encriptar contraseñas
const nodemailer = require('nodemailer'); //Paquetes necesarios para mandar correos usando sendgrid
const sendgridTransport = require('nodemailer-sendgrid-transport');
const User = require('../models/user');
const crypto = require('crypto');
const { validationResult } = require('express-validator'); // package necesitado para mostrar results de validaciones se instala con nom install --save express-validator

const transporter = nodemailer.createTransport(sendgridTransport({
   auth: {
      api_key: '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' // obtenida en el portal de sendgrid, seccion settings -> api keys
   }
}));

exports.getLogin = (req, res, next) => {
   let message = req.flash('error'); // busca el error definido por el key
   if (message.length > 0) {
      message = message[0];
   }
   else {
      message = null;
   }
   res.render('auth/login', {
      path: '/login',
      pageTitle: 'Login',
      errorMessage: message,
      oldInput: {
         email: '',
         password: '',
      },
      validationErrors: []
   });
};

exports.getSignup = (req, res, next) => {
   let message = req.flash('error'); // busca el error definido por el key
   if (message.length > 0) {
      message = message[0];
   }
   else {
      message = null;
   }
   res.render('auth/signup', {
      path: '/signup',
      pageTitle: 'Signup',
      errorMessage: message,
      oldInput: {
         email: '',
         password: '',
         confirmPassword: ''
      },
      validationErrors: []
   });
};

exports.postLogin = (req, res, next) => {
   const { email, password } = req.body;
   const errors = validationResult(req);
   if (!errors.isEmpty()) {
      return res.status(422).render('auth/login', { // status(422) es un estado utilizado para decir que hubo errores de validacion
         path: '/login',
         pageTitle: 'Login',
         errorMessage: errors.array()[0].msg,
         oldInput: {
            email: email,
            password: password
         },
         validationErrors: errors.array()
      });
   }

   User.findOne({ email: email })
      .then(user => {
         if (!user) {
            // req.flash('error', 'Invalid email or password');  // Almacena un error en pareja de key/value a ser mostrado en el proximo request
            return res.status(422).render('auth/login', { // status(422) es un estado utilizado para decir que hubo errores de validacion
               path: '/login',
               pageTitle: 'Login',
               errorMessage: 'Invalid email or password',
               oldInput: {
                  email: email,
                  password: password
               },
               validationErrors: []
            });
         }
         // compara si la string del primer parametro corresponde al password hash del segundo parametro y retorna una Promise bool (true o false)
         bcrypt.compare(password, user.password)
            .then(doMatch => {
               if (doMatch) {
                  req.session.isLoggedIn = true;
                  req.session.user = user;
                  return req.session.save(err => {
                     if (err) {
                        console.log(err);
                     }
                     res.redirect('/');
                  });
               }
               return res.status(422).render('auth/login', { // status(422) es un estado utilizado para decir que hubo errores de validacion
                  path: '/login',
                  pageTitle: 'Login',
                  errorMessage: 'Invalid email or password',
                  oldInput: {
                     email: email,
                     password: password
                  },
                  validationErrors: []
               });
            })
            .catch(err => {
               console.log(err);
               return res.redirect('/login');
            });
      })
      .catch(err => {
         const error = new Error(err);
         error.httpStatusCode = 500;
         return next(error);
      });
};

exports.postSignup = (req, res, next) => {
   const { email, password, confirmPassword } = req.body;
   const errors = validationResult(req); // obtiene los errores alamcenados en el request en el route auth.js
   if (!errors.isEmpty()) {
      return res.status(422).render('auth/signup', { // status(422) es un estado utilizado para decir que hubo errores de validacion
         path: '/signup',
         pageTitle: 'SignUp',
         errorMessage: errors.array()[0].msg,
         oldInput: {
            email: email,
            password: password,
            confirmPassword: confirmPassword
         },
         validationErrors: errors.array()
      });
   }

   // el primer parametro es la cadena que queremos hashear y el segundo parametro es la cantidad de veces que se hashea, 12 es buen numero de veces
   // retorna una Promise que tendra el password hasheado
   bcrypt.hash(password, 12)
      .then(hashedPassword => {
         const user = new User({
            email: email,
            password: hashedPassword,
            cart: { items: [] }
         });
         return user.save();
      })
      .then(result => {
         res.redirect('/login');
         return transporter.sendMail({
            to: email,
            from: 'mandres0807@gmail.com',
            subject: 'SignUp - Mandres Shop',
            html: '<h1>Signed up succesfully!</h1>'
         });
      })
      .catch(err => {
         const error = new Error(err);
         error.httpStatusCode = 500;
         return next(error);
      });
};

exports.postLogout = (req, res, next) => {
   req.session.destroy(err => {
      if (err) {
         console.log(err);
      }
      res.redirect('/');
   });
};

exports.getReset = (req, res, next) => {
   let message = req.flash('error'); // busca el error definido por el key
   if (message.length > 0) {
      message = message[0];
   }
   else {
      message = null;
   }
   res.render('auth/reset', {
      path: '/reset',
      pageTitle: 'Reset Password',
      errorMessage: message
   });
};

exports.postReset = (req, res, next) => {
   const email = req.body.email;
   crypto.randomBytes(32, (err, buffer) => {
      if (err) {
         console.log(err);
         return res.redirect('/reset');
      }
      const token = buffer.toString('hex'); // el token debe ser guardado como string pasando el parametro 'hex'
      User.findOne({ email: email })
         .then(user => {
            if (!user) {
               req.flash('error', 'No account with that email was found.');
               return res.redirect('/reset');
            }
            user.resetToken = token;
            user.resetTokenExpiration = Date.now() + 3600000;
            return user.save();
         })
         .then(result => {
            res.redirect('/');
            transporter.sendMail({
               to: email,
               from: 'mandres0807@gmail.com',
               subject: 'Password Reset',
               html: `
                  <h1>Password Reset</h1>
                  <p>You requested a password reset</p>
                  <p>Click this <a href="http://localhost:3000/reset/${token}">link</a> to set a new password.</p>
               `
            });
         })
         .catch(err => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
         });
   });
};

exports.getNewPassword = (req, res, next) => {
   const token = req.params.token;
   User.findOne({ resetToken: token, resetTokenExpiration: { $gt: Date.now() } })   //$gt es el operador greater than que puede comparar mayor que en mongodb
      .then(user => {
         let message = req.flash('error'); // busca el error definido por el key
         if (message.length > 0) {
            message = message[0];
         }
         else {
            message = null;
         }
         res.render('auth/new-password', {
            path: '/new-password',
            pageTitle: 'New Password',
            errorMessage: message,
            userId: user._id.toString(),
            passwordToken: token
         });
      })
      .catch(err => {
         const error = new Error(err);
         error.httpStatusCode = 500;
         return next(error);
      });
};

exports.postNewPassword = (req, res, next) => {
   const { password, userId, passwordToken } = req.body;
   let resetUser;
   User.findOne({ resetToken: passwordToken, resetTokenExpiration: { $gt: Date.now() } })
      .then(user => {
         resetUser = user;
         return bcrypt.hash(password, 12);
      })
      .then(hashedPassword => {
         resetUser.password = hashedPassword;
         resetUser.resetToken = undefined;
         resetUser.resetTokenExpiration = undefined;
         return resetUser.save();
      })
      .then(result => {
         res.redirect('/login');
      })
      .catch(err => {
         const error = new Error(err);
         error.httpStatusCode = 500;
         return next(error);
      });
};