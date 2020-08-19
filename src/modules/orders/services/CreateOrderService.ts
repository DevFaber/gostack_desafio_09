import { inject, injectable } from 'tsyringe'

import AppError from '@shared/errors/AppError'

import IProductsRepository from '@modules/products/repositories/IProductsRepository'
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository'
import Order from '../infra/typeorm/entities/Order'
import IOrdersRepository from '../repositories/IOrdersRepository'

interface IProduct {
  id: string
  quantity: number
}

interface IRequest {
  customer_id: string
  products: IProduct[]
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customerExists = await this.customersRepository.findById(customer_id)

    if (!customerExists) {
      throw new AppError('Cliente não encontrado!')
    }

    const productExists = await this.productsRepository.findAllById(products)

    if (!productExists.length) {
      throw new AppError('Produto não encontrado!')
    }

    const existentProductsIds = productExists.map(product => product.id)

    const inexistentProducts = products.filter(
      product => !existentProductsIds.includes(product.id),
    )

    if (inexistentProducts.length) {
      throw new AppError(
        `Não foi possível encontrar o produto ${inexistentProducts[0]}`,
      )
    }

    const checkProd = productExists.map(prod => ({
      id: prod.id,
      quantity: prod.quantity,
    }))

    const checkProdQty = checkProd.filter(prod =>
      products.filter(p => p.id === prod.id),
    )

    const quantRequired = products.map(product => ({
      id: product.id,
      quantity: product.quantity,
    }))

    const checkQtyRequired = quantRequired.filter(prod =>
      productExists.filter(p => p.id === prod.id),
    )

    if (checkQtyRequired[1] < checkProdQty[1]) {
      throw new AppError('Estoque insuficiente para este produto')
    }

    const serializedProducts = products.map(prod => ({
      product_id: prod.id,
      quantity: prod.quantity,
      price: productExists.filter(p => p.id === prod.id)[0].price,
    }))

    const order = this.ordersRepository.create({
      customer: customerExists,
      products: serializedProducts,
    })

    const orderedProdsQts = products.map(product => ({
      id: product.id,
      quantity:
        productExists.filter(p => p.id === product.id)[0].quantity -
        product.quantity,
    }))

    await this.productsRepository.updateQuantity(orderedProdsQts)

    return order
  }
}

export default CreateOrderService
