import { verify } from 'jsonwebtoken';
import dotenv from 'dotenv';
import { NextFunction, Request, Response } from 'express';

dotenv.config();

// ✅ Load environment variables
const PEPPER = process.env.PEPPER_SECRET!;
const JWT_SECRET = process.env.JWT_SECRET!;


// ========================
// 🔐 Auth Middleware
// ========================
 export const authMiddleware = (req: Request, res: Response, next: Function) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ message: 'Authorization header missing' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'Token missing' });
    }

    const decoded = verify(token, JWT_SECRET);
    (req as any).user = decoded; // attach decoded user to req
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

export function restrictTo(roles : String[]){
    return function(req : Request, res : Response, next : NextFunction){
        if(!((req as any).user))return res.redirect("/login");
        if(!roles.includes((req as any).user.role))return res.end("Unauthorized");
        return next();
    }
}

