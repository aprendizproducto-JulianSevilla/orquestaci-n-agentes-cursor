# Descuento de pedido

El sistema calcula el monto del descuento. No calcula el total a pagar.

## Criterios

1. Si el cliente es frecuente y el subtotal es mayor o igual a 100, el descuento es el 10% del subtotal.
2. El descuento nunca supera 50.
3. Si el cliente no es frecuente, el descuento es 0.
4. Si el subtotal es negativo, la operación lanza un error y no devuelve un descuento.
5. El resultado es el monto del descuento.
