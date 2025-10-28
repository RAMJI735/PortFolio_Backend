import { wrapAsync } from "./utils/WrapAsync.js";
import express from "express";
const app = express();
import "dotenv/config";
import nodemailer from "nodemailer";
import cors from "cors";

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors(
    {
        origin: "https://react-port-folio-pi.vercel.app/"
    }
));

app.get("/", (req, res) => {
    res.send("Hello World!");
});


app.post("/mail-send",wrapAsync( async (req, res) => {
    try {
        const { name, email, message, subject } = req.body;

        if (!name || !email || !message || !subject) {
            return res.status(400).json({
                success: false,
                message: "Name, Email and Message required!"
            });
        }

        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: +process.env.SMTP_PORT,
            secure: false,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });

        await transporter.sendMail({
            from: `"${name} via Website" <${process.env.SMTP_USER}>`,
            to: process.env.RECEIVER_EMAIL, // jaha email aani chahiye
            replyTo: email,
            subject: subject,
            text: `
                 Name: ${name}
                 Email: ${email}
                 Message: ${message}
      `
        });

        res.status(200).json({
            status: 200,
            success: true,
            message: "Message sent successfully!"
        });
    } catch (error) {
        console.error("Mail Send Error:", error);
        res.status(500).json({
            success: false,
            message: "Something went wrong while sending the message!"
        });
    }
}));


app.listen(4000, (req, res) => {
    console.log("Example app listening on port 4000");
});
