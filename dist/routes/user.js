"use strict";
// import { Router, Request, Response } from 'express';
// import prisma from '../prisma';
// import authMiddleware from '../middlewares/authMiddleware'; // ✅ use default import if you exported default
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// const router = Router();
// // ✅ Uncomment this if you want all routes to require authentication
// // router.use(authMiddleware);
// router.post('/signin', async (req: Request, res: Response) => {
//   try {
//     const { email, password, name, phone, address } = req.body;
//     // ✅ You should probably check if the user already exists
//     const existingUser = await prisma.user.findUnique({ where: { email } });
//     if (existingUser) {
//       return res.status(400).json({ message: 'User already exists' });
//     }
//     const user = await prisma.user.create({
//       data: {
//         email,
//         password, // ⚠️ ideally hash the password with bcrypt
//         name,
//         phone,
//         address,
//       },
//       select: {
//         id: true,
//         email: true,
//         name: true,
//         phone: true,
//         address: true,
//       },
//     });
//     return res.json({ user });
//   } catch (error) {
//     console.error(error);
//     return res.status(500).json({ message: 'Server error' });
//   }
// });
// // ✅ Example protected route
// router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
//   try {
//     const { id } = req.params;
//     const user = await prisma.user.findUnique({
//       where: { id: Number(id) }, // ensure numeric ID
//       select: {
//         id: true,
//         name: true,
//         email: true,
//         phone: true,
//         address: true,
//       },
//     });
//     if (!user) {
//       return res.status(404).json({ message: 'User not found' });
//     }
//     return res.json({ user });
//   } catch (error) {
//     console.error(error);
//     return res.status(500).json({ message: 'Server error' });
//   }
// });
// export default router;
const express_1 = require("express");
const prisma_1 = __importDefault(require("../prisma"));
const bcrypt_1 = __importDefault(require("bcrypt"));
// import jwt from 'jsonwebtoken';
const dotenv_1 = __importDefault(require("dotenv"));
const jsonwebtoken_1 = require("jsonwebtoken");
const authMiddleware_1 = require("../middlewares/authMiddleware");
dotenv_1.default.config();
const router = (0, express_1.Router)();
// ✅ Load environment variables
const PEPPER = process.env.PEPPER_SECRET;
const JWT_SECRET = process.env.JWT_SECRET;
// ========================
// 🧾 User Signup (Register)
// ========================
router.post('/signup', async (req, res) => {
    try {
        const { email, password, name, phone, address } = req.body;
        // Check if user exists
        const existingUser = await prisma_1.default.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }
        // ✅ Salt + Pepper hashing
        const hashedPassword = await bcrypt_1.default.hash(password + PEPPER, 10);
        const user = await prisma_1.default.user.create({
            data: {
                email,
                password: hashedPassword,
                name,
                phone,
                address,
            },
            select: {
                id: true,
                email: true,
                name: true,
            },
        });
        return res.status(201).json({
            message: 'User registered successfully',
            user,
        });
    }
    catch (error) {
        console.error('Signup Error:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});
// ========================
// 🔑 User Login
// ========================
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await prisma_1.default.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        // ✅ Verify password with pepper
        const isValid = await bcrypt_1.default.compare(password + PEPPER, user.password);
        if (!isValid) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        // ✅ Generate JWT
        const token = (0, jsonwebtoken_1.sign)({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });
        return res.json({
            message: 'Login successful',
            token,
        });
    }
    catch (error) {
        console.error('Login Error:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});
// ========================
// 🔒 Protected Route Example
// ========================
router.get('/profile', authMiddleware_1.authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId },
            select: { id: true, name: true, email: true, phone: true, address: true },
        });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        return res.json({ user });
    }
    catch (error) {
        console.error('Profile Error:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});
exports.default = router;
