"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkAdminsExist = void 0;
const auth_middleware_1 = require("./auth.middleware");
const statusCode_1 = __importDefault(require("../statusCode"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const checkAdminsExist = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const areAdminsPresent = yield prisma.admin.count();
        if (areAdminsPresent) {
            // If admins are present, apply auth middleware
            return (0, auth_middleware_1.adminAuthMiddleware)(req, res, next);
        }
        else {
            // If no admins are present, proceed without auth middleware
            return next();
        }
    }
    catch (error) {
        return res.status(statusCode_1.default.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Internal Server Error',
            message2: "Hi admin exist checking error"
        });
    }
});
exports.checkAdminsExist = checkAdminsExist;
