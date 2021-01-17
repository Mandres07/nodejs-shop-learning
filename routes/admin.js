const express = require('express');
const { body } = require('express-validator'); // package necesitado para hacer validaciones se instala con nom install --save express-validator

const adminController = require('../controllers/admin');
const isAuth = require('../middleware/is-auth');

const router = express.Router();

// en las routes se puede colocar diferentes handlers para verifcar cosas antes de proceder (isAuth)
// por ejemplo isAuth verifica que el usuario esta loggeado antes de proceder

// /admin/add-product => GET
router.get('/add-product', isAuth, adminController.getAddProduct);

// /admin/products => GET
router.get('/products', isAuth, adminController.getProducts);

// /admin/add-product => POST
router.post('/add-product',
   [
      body('title', 'Please insert a valid Title with at least 3 characters').isString().isLength({ min: 3 }).trim(),
      // body('imageUrl').isURL().withMessage('Please insert a valid image url.'),
      body('price').isFloat().withMessage('Please insert a valid price with two decimal places'),
      body('description', 'Please insert a description with a length of at least 5 characters and max of 400').isLength({ min: 5, max: 400 }).trim()
   ],
   isAuth, adminController.postAddProduct);

router.get('/edit-product/:productId', isAuth, adminController.getEditProduct);

router.post('/edit-product',
   [
      body('title', 'Please insert a valid Title with at least 3 characters').isString().isLength({ min: 3 }).trim(),
      // body('imageUrl', 'Please insert a valid image url.').isURL(),
      body('price', 'Please insert a valid price with two decimal places').isFloat(),
      body('description', 'Please insert a description with a length of at least 5 characters and max of 400').isLength({ min: 5, max: 400 }).trim()
   ],
   isAuth, adminController.postEditProduct);

router.delete('/product/:productId', isAuth, adminController.deleteProduct);

router.post('/delete-product', isAuth, adminController.postDeleteProduct);

module.exports = router;
