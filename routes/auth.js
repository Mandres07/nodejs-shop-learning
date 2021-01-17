const express = require('express');
const { check, body } = require('express-validator'); // package necesitado para hacer validaciones se instala con nom install --save express-validator
const authController = require('../controllers/auth');
const User = require('../models/user');

const router = express.Router();

router.get('/login', authController.getLogin);

router.get('/signup', authController.getSignup);

router.post('/login',
   [
      body('email').isEmail().withMessage('Please enter a valid Email.').normalizeEmail(),
      body('password', 'Password must have with only numbers and text and at least 5 characters.')
         .isLength({ min: 5 })
         .isAlphanumeric().trim(),
   ],
   authController.postLogin);

// check('email').isEmail().withMessage() valida el campo email sea un correo y almacena el resultado en el request
router.post('/signup',
   [ // los checks se colocan como un array de checks usando check o body si el valor a comprobar viene en el body del form
      check('email')
         .isEmail()
         .withMessage('Please enter a valid Email.')
         // se puede crear una validacion asincrona en este caso para verificar si existe un usuario con el email, la validacion falla si devuelve un Promise.reject('mensaje de error')
         .custom((value, { req }) => {
            return User.findOne({ email: value })
               .then(userDoc => {
                  if (userDoc) {
                     return Promise.reject('Email exist already, pick a different one.');
                  }
               });
         }).normalizeEmail(),
      // el mensaje de error se puede colocar como un mensaje general a todas las validaciones echas al campo pasandola como segundo parametro
      body('password', 'Please enter a password with only numbers and text and at least 5 characters.')
         .isLength({ min: 5 })
         .isAlphanumeric().trim(),
      // es posible encadenar validaciones y crear validaciones personalizadas con custom((value, {}) => {}) retornar un throw error cuando validacion falla y true cuando es correcta
      body('confirmPassword')
         .custom((value, { req }) => {
            if (value !== req.body.password) {
               throw new Error('Passwords do not match.')
            }
            return true
         }).trim()
   ], authController.postSignup
);

router.post('/logout', authController.postLogout);

router.get('/reset', authController.getReset);

router.post('/reset', authController.postReset);

router.get('/reset/:token', authController.getNewPassword);

router.post('/new-password', authController.postNewPassword);

module.exports = router;