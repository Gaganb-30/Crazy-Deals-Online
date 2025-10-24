import {Router, Request, Response} from 'express';
import prisma from '../prisma';
import { restrictTo } from '../middlewares/authMiddleware';

const router = Router();

router.get('/', async (req : Request, res : Response) => {
  const books = await prisma.book.findMany({
    select:{
      id : true,
      title : true,
      price : true,
      available : true,
    }
  });
  res.json({books : books});
})


// router.post('/create', restrictTo(['ADMIN']), async (req, res) => {
router.post('/create', async (req, res) => {
  const body = req.body;
  const book = await prisma.book.create({
    data:{
      title : body.title,
      publisher : body.publisher,
      language : body.language,
      price : body.price,
      about : body.about,
      format : body.format,
      details : {
        create : {
          isbn : body.isbn,
          pages : body.pages,
          country : body.country,
        }
      }
    }
  })
  res.json(book);
})


router.get('/:id', async (req : Request, res : Response) => {
  const book = await prisma.book.findUnique({
    where:{
      id : Number(req.params.id),
    },
    include : {
      details : true,
    }
  });
  res.json(book);
})

export default router;

