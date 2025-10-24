import { Router, Request, Response } from 'express';
import prisma from '../prisma';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

// All cart routes require authentication
router.use(authMiddleware);

// ========================
// 📦 Get User's Cart
// ========================
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;

    let cart = await prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            book: {
              select: {
                id: true,
                title: true,
                price: true,
                available: true,
                format: true,
              },
            },
          },
        },
      },
    });

    // Create cart if doesn't exist
    if (!cart) {
      cart = await prisma.cart.create({
        data: { userId },
        include: {
          items: {
            include: {
              book: {
                select: {
                  id: true,
                  title: true,
                  price: true,
                  available: true,
                  format: true,
                },
              },
            },
          },
        },
      });
    }

    // Calculate total
    const total = cart.items.reduce(
      (sum, item) => sum + item.book.price * item.quantity,
      0
    );

    return res.json({
      cart: {
        id: cart.id,
        items: cart.items,
        total: total.toFixed(2),
        itemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0),
      },
    });
  } catch (error) {
    console.error('Get Cart Error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// ========================
// ➕ Add Item to Cart
// ========================
router.post('/add', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { bookId, quantity = 1 } = req.body;

    if (!bookId) {
      return res.status(400).json({ message: 'Book ID is required' });
    }

    // Check if book exists and is available
    const book = await prisma.book.findUnique({
      where: { id: Number(bookId) },
    });

    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    if (!book.available) {
      return res.status(400).json({ message: 'Book is not available' });
    }

    // Get or create cart
    let cart = await prisma.cart.findUnique({
      where: { userId },
    });

    if (!cart) {
      cart = await prisma.cart.create({
        data: { userId },
      });
    }

    // Check if item already exists in cart
    const existingItem = await prisma.cartItem.findUnique({
      where: {
        cartId_bookId: {
          cartId: cart.id,
          bookId: Number(bookId),
        },
      },
    });

    if (existingItem) {
      // Update quantity
      const updatedItem = await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: {
          quantity: existingItem.quantity + quantity,
        },
        include: {
          book: {
            select: {
              id: true,
              title: true,
              price: true,
            },
          },
        },
      });

      return res.json({
        message: 'Cart updated',
        item: updatedItem,
      });
    } else {
      // Add new item
      const newItem = await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          bookId: Number(bookId),
          quantity,
        },
        include: {
          book: {
            select: {
              id: true,
              title: true,
              price: true,
            },
          },
        },
      });

      return res.status(201).json({
        message: 'Item added to cart',
        item: newItem,
      });
    }
  } catch (error) {
    console.error('Add to Cart Error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// ========================
// 🔄 Update Cart Item Quantity
// ========================
router.patch('/update/:itemId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { itemId } = req.params;
    const { quantity } = req.body;

    if (!quantity || quantity < 1) {
      return res.status(400).json({ message: 'Valid quantity is required' });
    }

    // Verify item belongs to user's cart
    const item = await prisma.cartItem.findUnique({
      where: { id: Number(itemId) },
      include: { cart: true },
    });

    if (!item || item.cart.userId !== userId) {
      return res.status(404).json({ message: 'Cart item not found' });
    }

    const updatedItem = await prisma.cartItem.update({
      where: { id: Number(itemId) },
      data: { quantity },
      include: {
        book: {
          select: {
            id: true,
            title: true,
            price: true,
          },
        },
      },
    });

    return res.json({
      message: 'Quantity updated',
      item: updatedItem,
    });
  } catch (error) {
    console.error('Update Cart Error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// ========================
// ❌ Remove Item from Cart
// ========================
router.delete('/remove/:itemId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { itemId } = req.params;

    // Verify item belongs to user's cart
    const item = await prisma.cartItem.findUnique({
      where: { id: Number(itemId) },
      include: { cart: true },
    });

    if (!item || item.cart.userId !== userId) {
      return res.status(404).json({ message: 'Cart item not found' });
    }

    await prisma.cartItem.delete({
      where: { id: Number(itemId) },
    });

    return res.json({ message: 'Item removed from cart' });
  } catch (error) {
    console.error('Remove from Cart Error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// ========================
// 🗑️ Clear Cart
// ========================
router.delete('/clear', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;

    const cart = await prisma.cart.findUnique({
      where: { userId },
    });

    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    await prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    return res.json({ message: 'Cart cleared' });
  } catch (error) {
    console.error('Clear Cart Error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;