// funcion que elimina productos con click al boton de manera asincronica y envia una respuesta como AJAX pero usando fetch

const deleteProduct = (btn) => {
   // accediendo al DOM para obtener los inputs con querySelector by name
   const prodId = btn.parentNode.querySelector('[name=productId]').value;
   const csrf = btn.parentNode.querySelector('[name=_csrf]').value;

   //  obteniendo el elemento padre mas cercano de tipo article
   const productElement = btn.closest('article')

   // fetch es como AJAX, te permite enviar request al servidor, si no le colocamos http:// al inicio se envia al mismo server
   fetch('/admin/product/' + prodId, {
      method: 'DELETE',
      headers: {
         'csrf-token': csrf
      }
   })
      .then(result => {
         return result.json();
      })
      .then(data => {
         console.log(data);
         productElement.remove();
      })
      .catch(err => console.log(err));
};