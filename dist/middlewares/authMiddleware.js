"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = void 0;
exports.restrictTo = restrictTo;
const jsonwebtoken_1 = require("jsonwebtoken");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// ✅ Load environment variables
const PEPPER = process.env.PEPPER_SECRET;
const JWT_SECRET = process.env.JWT_SECRET;
// ========================
// 🔐 Auth Middleware
// ========================
const authMiddleware = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ message: 'Authorization header missing' });
        }
        const token = authHeader.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Token missing' });
        }
        const decoded = (0, jsonwebtoken_1.verify)(token, JWT_SECRET);
        req.user = decoded; // attach decoded user to req
        next();
    }
    catch (error) {
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
};
exports.authMiddleware = authMiddleware;
function restrictTo(roles) {
    return function (req, res, next) {
        if (!(req.user))
            return res.redirect("/login");
        if (!roles.includes(req.user.role))
            return res.end("Unauthorized");
        return next();
    };
}
