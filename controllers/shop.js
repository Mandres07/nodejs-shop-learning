const Product = require('../models/product');
const Order = require('../models/order');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
// importanndo stripe con api key para ser usado dentro del server en nodejs y javascript
const stripe = require('stripe')('api_key');

const ITEMS_PER_PAGE = 2;

exports.getProducts = (req, res, next) => {
   const page = +req.query.page || 1;
   let totalItems;

   Product.countDocuments()
      .then(numProducts => {
         totalItems = numProducts;
         return Product.find()
            .skip((page - 1) * ITEMS_PER_PAGE) // skip() define cuantos registros se deben ignorar empezando por el primero 
            .limit(ITEMS_PER_PAGE); // limit() define cuantos registros debe traer la consulta
      })
      .then(products => {
         res.render('shop/product-list', {
            prods: products,
            pageTitle: 'All Products',
            path: '/products',
            currentPage: page,
            hasNextPage: ITEMS_PER_PAGE * page < totalItems,
            hasPreviousPage: page > 1,
            nextPage: page + 1,
            previousPage: page - 1,
            lastPage: Math.ceil(totalItems / ITEMS_PER_PAGE)
         });
      })
      .catch(err => {
         const error = new Error(err);
         error.httpStatusCode = 500;
         return next(error);
      });
};

exports.getProduct = (req, res, next) => {
   // para obtener un parametro definido en la ruta se usa params y el nombre definido en la ruta
   const prodId = req.params.productId;
   Product.findById(prodId)
      .then(product => {
         res.render('shop/product-detail', {
            product: product,
            pageTitle: product.title,
            path: '/products'
         });
      })
      .catch(err => {
         const error = new Error(err);
         error.httpStatusCode = 500;
         return next(error);
      });
};

exports.getIndex = (req, res, next) => {
   // cuando se quiere obtener un query parameter se usa query y el nombre del parametro definido en el url
   // el + de adelante es para que el page se trate como un numero y no como string
   // el operador || indica que cuando page sea indefinido o nulo se guarde 1
   const page = +req.query.page || 1;
   let totalItems;

   Product.countDocuments()
      .then(numProducts => {
         totalItems = numProducts;
         return Product.find()
            .skip((page - 1) * ITEMS_PER_PAGE) // skip() define cuantos registros se deben ignorar empezando por el primero 
            .limit(ITEMS_PER_PAGE); // limit() define cuantos registros debe traer la consulta
      })
      .then(products => {
         res.render('shop/index', {
            prods: products,
            pageTitle: 'Shop',
            path: '/',
            currentPage: page,
            hasNextPage: ITEMS_PER_PAGE * page < totalItems,
            hasPreviousPage: page > 1,
            nextPage: page + 1,
            previousPage: page - 1,
            lastPage: Math.ceil(totalItems / ITEMS_PER_PAGE)
         });
      })
      .catch(err => {
         const error = new Error(err);
         error.httpStatusCode = 500;
         return next(error);
      });
};

exports.getCart = (req, res, next) => {
   req.user
      .populate('cart.items.productId')
      .execPopulate()
      .then(user => {
         const products = user.cart.items;
         res.render('shop/cart', {
            path: '/cart',
            pageTitle: 'Your Cart',
            products: products
         });
      })
      .catch(err => {
         const error = new Error(err);
         error.httpStatusCode = 500;
         return next(error);
      });
};

exports.postCart = (req, res, next) => {
   const prodId = req.body.productId;
   Product.findById(prodId)
      .then(product => {
         return req.user.addToCart(product);
      })
      .then(result => {
         // console.log(result);
         res.redirect('/cart');
      });
};

exports.postCartDeleteProduct = (req, res, next) => {
   const prodId = req.body.productId;
   req.user
      .removeFromCart(prodId)
      .then(result => {
         res.redirect('/cart');
      })
      .catch(err => {
         const error = new Error(err);
         error.httpStatusCode = 500;
         return next(error);
      });
};

exports.getCheckout = (req, res, next) => {
   let products;
   let totalSum = 0;

   req.user
      .populate('cart.items.productId')
      .execPopulate()
      .then(user => {
         products = user.cart.items;
         // usando reduce para calcular el total de la compra (acumulado)
         totalSum = products.reduce((totalPrice, product) => {
            return totalPrice + product.productId.price;
         }, 0).toFixed(2);

         // crea una session en stripe con los datos de la compra para poder relizar el pago
         return stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: products.map(p => { // los items debe tener este formato estrictamente por eso hacemos un map
               return {
                  name: p.productId.title,
                  description: p.productId.description,
                  amount: p.productId.price * 100, // se requiere en centavos
                  currency: 'usd',
                  quantity: p.quantity
               }
            }),
            success_url: req.protocol + '://' + req.get('host') + '/checkout/success', // redireccion cuando todo ok
            cancel_url: req.protocol + '://' + req.get('host') + '/checkout/cancel' // redirecion cuando cancela
         });
      })
      .then(session => {
         res.render('shop/checkout', {
            path: '/checkout',
            pageTitle: 'Checkout Page',
            products: products,
            totalSum: totalSum,
            sessionId: session.id // aqui pasamos la sessionId de stripe
         });
      })
      .catch(err => {
         const error = new Error(err);
         error.httpStatusCode = 500;
         return next(error);
      });
};

exports.getCheckoutSuccess = (req, res, next) => {
   req.user
      .populate('cart.items.productId')
      .execPopulate()
      .then(user => {
         const products = user.cart.items.map(i => {
            return { quantity: i.quantity, product: { ...i.productId._doc } };
         });
         const order = new Order({
            user: {
               email: req.user.email,
               userId: req.user
            },
            products: products
         });
         return order.save();
      })
      .then(result => {
         return req.user.clearCart();
      })
      .then(() => {
         res.redirect('/orders');
      })
      .catch(err => {
         const error = new Error(err);
         error.httpStatusCode = 500;
         return next(error);
      });
};

exports.postOrder = (req, res, next) => {
   req.user
      .populate('cart.items.productId')
      .execPopulate()
      .then(user => {
         const products = user.cart.items.map(i => {
            return { quantity: i.quantity, product: { ...i.productId._doc } };
         });
         const order = new Order({
            user: {
               email: req.user.email,
               userId: req.user
            },
            products: products
         });
         return order.save();
      })
      .then(result => {
         return req.user.clearCart();
      })
      .then(() => {
         res.redirect('/orders');
      })
      .catch(err => {
         const error = new Error(err);
         error.httpStatusCode = 500;
         return next(error);
      });
};

exports.getOrders = (req, res, next) => {
   Order.find({ 'user.userId': req.user._id })
      .then(orders => {
         res.render('shop/orders', {
            path: '/orders',
            pageTitle: 'Your Orders',
            orders: orders
         });
      })
      .catch(err => {
         const error = new Error(err);
         error.httpStatusCode = 500;
         return next(error);
      });
};

exports.getInvoice = (req, res, next) => {
   const orderId = req.params.orderId;
   Order.findById(orderId)
      .then(order => {
         if (!order) {
            return next(new Error('No order found.'));
         }
         if (order.user.userId.toString() !== req.user._id.toString()) {
            return next(new Error('Unauthorized.'));
         }
         const invoiceName = 'invoice-' + orderId + '.pdf';
         const invoicePath = path.join('data', 'invoices', invoiceName);

         // Para crear un PDF por codigo usando PDFKit
         // ===============================================================================

         const pdfDoc = new PDFDocument();
         res.setHeader('Content-Type', 'application/pdf');
         res.setHeader('Content-Disposition', 'inline; filename="' + invoiceName + '"');

         pdfDoc.pipe(fs.createWriteStream(invoicePath));
         pdfDoc.pipe(res);

         pdfDoc.fontSize(26).text('Invoice', {
            underline: true
         });
         pdfDoc.text('-------------------------------------------------');
         let totalPrice = 0;
         order.products.forEach(prod => {
            totalPrice = totalPrice + (prod.quantity * prod.product.price);
            pdfDoc.fontSize(14).text(`${prod.product.title} - ${prod.quantity} x $${prod.product.price}`);
         });
         pdfDoc.text('-------------------------------------------------');
         pdfDoc.fontSize(20).text(`Total Price: $${totalPrice}`);

         pdfDoc.end();

         // ===============================================================================


         // De esta forma se puede leer archivos de memoria. Tener cuidado con archivos grandes que pueden consumir mucha memoria
         // fs.readFile(invoicePath, (err, data) => {
         //    if (err) {
         //       return next(err);
         //    }
         //    res.setHeader('Content-Type', 'application/pdf');
         //    res.setHeader('Content-Disposition', 'inline; filename="' + invoiceName + '"');
         //    res.send(data);
         // });

         // De esta forma se envia e archivo como un stream que el navegador lee directamente sin ser guardado los archivos en memoria
         // const file = fs.createReadStream(invoicePath);
         // res.setHeader('Content-Type', 'application/pdf');
         // res.setHeader('Content-Disposition', 'inline; filename="' + invoiceName + '"');
         // file.pipe(res);
      })
      .catch(err => next(err));
}
