const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const nodemailer = require("nodemailer");
const twilio = require("twilio");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const User = require("./models/User");
const OTP = require("./models/OTP");
const Transaction = require("./models/Transaction");
const Loan = require("./models/Loan");
const MoneyRequest = require("./models/MoneyRequest");

// =============================
// MONGODB CONNECTION
// =============================
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB Connected Successfully"))
    .catch((err) => console.log("MongoDB Connection Error:", err));

// =============================
// ROUTES FOR HTML PAGES
// =============================
app.get("/", (req, res) => {
    res.sendFile(__dirname + "/BankFE.html");
});

app.get("/admin", (req, res) => {
    res.sendFile(__dirname + "/AdminFE.html");
});

// =============================
// SERVER START
// =============================
app.listen(5000, 'localhost', () => {
    console.log("Server running locally on http://localhost:5000");
});

// =============================
// EMAIL TRANSPORTER
// =============================
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// =============================
// TWILIO SETUP
// =============================
const twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

// =============================
// HELPERS
// =============================
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function isValidGmail(username) {
    return /^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(username);
}

function isValidMobile(username) {
    return /^[6-9]\d{9}$/.test(username);
}

function isStrongPassword(password) {
    return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&.#^()_+\-=])[A-Za-z\d@$!%*?&.#^()_+\-=]{8,}$/.test(password);
}

function normalizeUsername(username = "") {
    return String(username).trim();
}

// =============================
// SIGNUP
// =============================
app.post("/signup", async (req, res) => {
    try {
        let { username, password, voicePhrase } = req.body;

        username = normalizeUsername(username);
        password = String(password || "").trim();
        voicePhrase = String(voicePhrase || "").trim();

        if (!username || !password || !voicePhrase) {
            return res.json({
                success: false,
                message: "All fields are required"
            });
        }

        if (!isValidGmail(username) && !isValidMobile(username)) {
            return res.json({
                success: false,
                message: "Username must be a Gmail or 10-digit mobile number"
            });
        }

        if (!isStrongPassword(password)) {
            return res.json({
                success: false,
                message: "Password must be at least 8 characters with uppercase, lowercase, number and symbol"
            });
        }

        const existingUser = await User.findOne({ username });

        if (existingUser) {
            return res.json({
                success: false,
                message: "User already exists"
            });
        }

        const newUser = new User({
            username,
            password,
            voicePhrase,
            accountNumber: "519576578364",
            ifsc: "SBIN0000456",
            branch: "Habshiguda Branch",
            branchCode: "4567",
            phone: isValidMobile(username) ? username : "",
            email: isValidGmail(username) ? username : ""
        });

        await newUser.save();

        return res.json({
            success: true,
            message: "Signup successful"
        });

    } catch (error) {
        console.error("Signup Error:", error);
        return res.json({
            success: false,
            message: "Signup failed"
        });
    }
});

// =============================
// LOGIN + SEND OTP
// =============================
app.post("/login", async (req, res) => {
    try {
        let { username, password } = req.body;

        username = normalizeUsername(username);
        password = String(password || "").trim();

        if (!username || !password) {
            return res.json({
                success: false,
                message: "Username and password are required"
            });
        }

        const user = await User.findOne({ username, password });

        if (!user) {
            return res.json({
                success: false,
                message: "Invalid username or password"
            });
        }

        // EMAIL OTP
        if (isValidGmail(username)) {
            await OTP.deleteMany({ username });

            const otp = generateOTP();

            await OTP.create({
                username,
                otp
            });

            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: username,
                subject: "Your Secure Banking OTP",
                html: `
                    <h2>Secure Banking Login OTP</h2>
                    <p>Your OTP is:</p>
                    <h1 style="color:#6366f1;">${otp}</h1>
                    <p>This OTP is valid for 5 minutes.</p>
                    <p>Do not share this OTP with anyone.</p>
                `
            });

            return res.json({
                success: true,
                message: "OTP sent to your Gmail",
                otpType: "email"
            });
        }

        // MOBILE OTP
        if (isValidMobile(username)) {
            try {
                const verification = await twilioClient.verify.v2
                    .services(process.env.TWILIO_VERIFY_SERVICE_SID)
                    .verifications.create({
                        to: `+91${username}`,
                        channel: "sms"
                    });

                console.log("Twilio Verification Success:", verification.sid, verification.status);

                return res.json({
                    success: true,
                    message: "OTP sent to your mobile number",
                    otpType: "mobile"
                });

            } catch (twilioError) {
                console.error("Twilio Mobile OTP Error:", twilioError);

                return res.json({
                    success: false,
                    message: twilioError.message || "Failed to send mobile OTP"
                });
            }
        }

        return res.json({
            success: false,
            message: "Unsupported username format"
        });

    } catch (error) {
        console.error("Login Error:", error);
        return res.json({
            success: false,
            message: "Login / OTP send error"
        });
    }
});

// =============================
// VERIFY OTP
// =============================
app.post("/verify-otp", async (req, res) => {
    try {
        let { username, otp } = req.body;

        username = normalizeUsername(username);
        otp = String(otp || "").trim();

        if (!username || !otp) {
            return res.json({
                success: false,
                message: "Username and OTP are required"
            });
        }

        // EMAIL OTP VERIFY
        if (isValidGmail(username)) {
            const otpRecord = await OTP.findOne({ username, otp });

            if (!otpRecord) {
                return res.json({
                    success: false,
                    message: "Invalid or expired OTP"
                });
            }

            await OTP.deleteMany({ username });

            return res.json({
                success: true,
                message: "Email OTP verified successfully"
            });
        }

        // MOBILE OTP VERIFY
        if (isValidMobile(username)) {
            try {
                const verificationCheck = await twilioClient.verify.v2
                    .services(process.env.TWILIO_VERIFY_SERVICE_SID)
                    .verificationChecks.create({
                        to: `+91${username}`,
                        code: otp
                    });

                console.log("Twilio OTP Verify Result:", verificationCheck.status);

                if (verificationCheck.status === "approved") {
                    return res.json({
                        success: true,
                        message: "Mobile OTP verified successfully"
                    });
                } else {
                    return res.json({
                        success: false,
                        message: "Invalid or expired mobile OTP"
                    });
                }

            } catch (twilioError) {
                console.error("Twilio OTP Verify Error:", twilioError);

                return res.json({
                    success: false,
                    message: twilioError.message || "Mobile OTP verification failed"
                });
            }
        }

        return res.json({
            success: false,
            message: "Unsupported username format"
        });

    } catch (error) {
        console.error("OTP Verification Error:", error);
        return res.json({
            success: false,
            message: "OTP verification failed"
        });
    }
});

// =============================
// VERIFY VOICE PHRASE
// =============================
app.post("/verify-voice", async (req, res) => {
    try {
        let { username, spokenPhrase } = req.body;

        username = normalizeUsername(username);
        spokenPhrase = String(spokenPhrase || "").trim();

        if (!username || !spokenPhrase) {
            return res.json({
                success: false,
                message: "Username and spoken phrase are required"
            });
        }

        const user = await User.findOne({ username });

        if (!user) {
            return res.json({
                success: false,
                message: "User not found"
            });
        }

        const savedPhrase = String(user.voicePhrase || "").trim().toLowerCase();
        const spoken = spokenPhrase.trim().toLowerCase();

        if (savedPhrase === spoken) {
            return res.json({
                success: true,
                message: "Voice verified successfully"
            });
        } else {
            return res.json({
                success: false,
                message: "Voice phrase did not match"
            });
        }

    } catch (error) {
        console.error("Voice Verification Error:", error);
        return res.json({
            success: false,
            message: "Voice verification failed"
        });
    }
});

// =============================
// FORGOT PASSWORD - SEND OTP
// =============================
app.post("/forgot-password-send-otp", async (req, res) => {
    try {
        let { username } = req.body;

        username = normalizeUsername(username);

        if (!username) {
            return res.json({
                success: false,
                message: "Username is required"
            });
        }

        const user = await User.findOne({ username });

        if (!user) {
            return res.json({
                success: false,
                message: "User not found"
            });
        }

        // EMAIL FORGOT PASSWORD OTP
        if (isValidGmail(username)) {
            await OTP.deleteMany({ username });

            const otp = generateOTP();

            await OTP.create({
                username,
                otp
            });

            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: username,
                subject: "Reset Password OTP",
                html: `
                    <h2>Password Reset OTP</h2>
                    <p>Your OTP is:</p>
                    <h1 style="color:#6366f1;">${otp}</h1>
                    <p>This OTP is valid for 5 minutes.</p>
                    <p>Do not share this OTP with anyone.</p>
                `
            });

            return res.json({
                success: true,
                message: "Password reset OTP sent to Gmail"
            });
        }

        // MOBILE FORGOT PASSWORD OTP
        if (isValidMobile(username)) {
            try {
                const verification = await twilioClient.verify.v2
                    .services(process.env.TWILIO_VERIFY_SERVICE_SID)
                    .verifications.create({
                        to: `+91${username}`,
                        channel: "sms"
                    });

                console.log("Twilio Forgot Password OTP Success:", verification.sid, verification.status);

                return res.json({
                    success: true,
                    message: "Password reset OTP sent to mobile number"
                });

            } catch (twilioError) {
                console.error("Twilio Forgot Password OTP Error:", twilioError);

                return res.json({
                    success: false,
                    message: twilioError.message || "Failed to send forgot password OTP"
                });
            }
        }

        return res.json({
            success: false,
            message: "Unsupported username format"
        });

    } catch (error) {
        console.error("Forgot Password Send OTP Error:", error);
        return res.json({
            success: false,
            message: "Failed to send forgot password OTP"
        });
    }
});

// =============================
// FORGOT PASSWORD - VERIFY OTP
// =============================
app.post("/forgot-password-verify-otp", async (req, res) => {
    try {
        let { username, otp } = req.body;

        username = normalizeUsername(username);
        otp = String(otp || "").trim();

        if (!username || !otp) {
            return res.json({
                success: false,
                message: "Username and OTP are required"
            });
        }

        // EMAIL OTP VERIFY
        if (isValidGmail(username)) {
            const otpRecord = await OTP.findOne({ username, otp });

            if (!otpRecord) {
                return res.json({
                    success: false,
                    message: "Invalid or expired OTP"
                });
            }

            return res.json({
                success: true,
                message: "OTP verified successfully"
            });
        }

        // MOBILE OTP VERIFY
        if (isValidMobile(username)) {
            try {
                const verificationCheck = await twilioClient.verify.v2
                    .services(process.env.TWILIO_VERIFY_SERVICE_SID)
                    .verificationChecks.create({
                        to: `+91${username}`,
                        code: otp
                    });

                console.log("Twilio Forgot Password Verify Result:", verificationCheck.status);

                if (verificationCheck.status === "approved") {
                    return res.json({
                        success: true,
                        message: "OTP verified successfully"
                    });
                } else {
                    return res.json({
                        success: false,
                        message: "Invalid or expired mobile OTP"
                    });
                }

            } catch (twilioError) {
                console.error("Twilio Forgot Password Verify Error:", twilioError);

                return res.json({
                    success: false,
                    message: twilioError.message || "Forgot password OTP verification failed"
                });
            }
        }

        return res.json({
            success: false,
            message: "Unsupported username format"
        });

    } catch (error) {
        console.error("Forgot Password Verify OTP Error:", error);
        return res.json({
            success: false,
            message: "OTP verification failed"
        });
    }
});

// =============================
// RESET PASSWORD
// =============================
app.post("/reset-password", async (req, res) => {
    try {
        let { username, newPassword } = req.body;

        username = normalizeUsername(username);
        newPassword = String(newPassword || "").trim();

        if (!username || !newPassword) {
            return res.json({
                success: false,
                message: "Username and new password are required"
            });
        }

        if (!isStrongPassword(newPassword)) {
            return res.json({
                success: false,
                message: "Password must be at least 8 characters with uppercase, lowercase, number and symbol"
            });
        }

        const updatedUser = await User.findOneAndUpdate(
            { username },
            { password: newPassword },
            { new: true }
        );

        if (!updatedUser) {
            return res.json({
                success: false,
                message: "User not found"
            });
        }

        await OTP.deleteMany({ username });

        return res.json({
            success: true,
            message: "Password reset successful"
        });

    } catch (error) {
        console.error("Reset Password Error:", error);
        return res.json({
            success: false,
            message: "Password reset failed"
        });
    }
});

// =============================
// GET USER
// =============================
app.get("/user/:username", async (req, res) => {
    try {
        const username = normalizeUsername(req.params.username);

        const user = await User.findOne({ username });

        if (!user) {
            return res.json({
                success: false,
                message: "User not found"
            });
        }

        return res.json({
            success: true,
            data: user
        });

    } catch (error) {
        console.error("Get User Error:", error);
        return res.json({
            success: false,
            message: "Failed to fetch user"
        });
    }
});

// =============================
// UPDATE USER
// =============================
app.put("/update/:username", async (req, res) => {
    try {
        const username = normalizeUsername(req.params.username);
        const updates = { ...req.body };

        // prevent accidental username/account tampering in demo app
        delete updates.username;
        delete updates.accountNumber;
        delete updates.ifsc;
        delete updates.branchCode;

        const updatedUser = await User.findOneAndUpdate(
            { username },
            updates,
            { new: true }
        );

        if (!updatedUser) {
            return res.json({
                success: false,
                message: "User not found"
            });
        }

        return res.json({
            success: true,
            data: updatedUser
        });

    } catch (error) {
        console.error("Update Error:", error);
        return res.json({
            success: false,
            message: "Update failed"
        });
    }
});

// =============================
// TRANSFER MONEY
// =============================
app.post("/transfer", async (req, res) => {
    try {
        let { senderUsername, receiverIdentifier, amount, description } = req.body;
        
        senderUsername = normalizeUsername(senderUsername);
        receiverIdentifier = normalizeUsername(receiverIdentifier);
        amount = Number(amount);

        if (!senderUsername || !receiverIdentifier || !amount || amount <= 0) {
            return res.json({ success: false, message: "Invalid transfer details" });
        }

        const sender = await User.findOne({ username: senderUsername });
        if (!sender) return res.json({ success: false, message: "Sender not found" });

        if (sender.balance < amount) {
            return res.json({ success: false, message: "Insufficient balance" });
        }

        // find receiver by username, email, or phone
        const receiver = await User.findOne({
            $or: [
                { username: receiverIdentifier },
                { email: receiverIdentifier },
                { phone: receiverIdentifier }
            ]
        });

        if (!receiver) return res.json({ success: false, message: "Receiver not found" });
        
        if (sender.username === receiver.username) {
            return res.json({ success: false, message: "Cannot transfer to self" });
        }

        // deduct from sender
        sender.balance -= amount;
        await sender.save();

        // add to receiver
        receiver.balance += amount;
        if (!receiver.notifications) receiver.notifications = [];
        receiver.notifications.push({ message: `You received ₹${amount.toLocaleString('en-IN')} from ${sender.username}.`, type: "success" });
        await receiver.save();

        const refId = "NEX" + Date.now().toString().slice(-8);

        const transaction = new Transaction({
            sender: sender.username,
            receiver: receiver.username,
            amount: amount,
            description: description || "Fund Transfer",
            status: "Completed",
            referenceId: refId
        });
        await transaction.save();

        return res.json({ success: true, message: "Transfer successful", data: transaction });
    } catch (error) {
        console.error("Transfer error:", error);
        return res.json({ success: false, message: "Transfer failed" });
    }
});

// =============================
// PAY BILL
// =============================
app.post("/pay-bill", async (req, res) => {
    try {
        let { username, billType, provider, amount } = req.body;
        username = normalizeUsername(username);
        amount = Number(amount);

        if (!username || !provider || !amount || amount <= 0) {
            return res.json({ success: false, message: "Invalid bill details" });
        }

        const user = await User.findOne({ username });
        if (!user) return res.json({ success: false, message: "User not found" });

        if (user.balance < amount) {
            return res.json({ success: false, message: "Insufficient balance" });
        }

        user.balance -= amount;
        await user.save();

        const tx = new Transaction({
            sender: user.username,
            receiver: "Biller - " + provider,
            amount: amount,
            description: `${billType} Bill Payment`,
            status: "Completed",
            referenceId: "BILL" + Date.now().toString().slice(-6)
        });
        await tx.save();

        return res.json({ success: true, message: "Bill paid successfully", data: tx });
    } catch (error) {
        console.error("Pay bill error:", error);
        return res.json({ success: false, message: "Bill payment failed" });
    }
});

// =============================
// RECHARGE
// =============================
app.post("/recharge", async (req, res) => {
    try {
        let { username, mobileNumber, operator, amount } = req.body;
        username = normalizeUsername(username);
        amount = Number(amount);

        if (!username || !mobileNumber || !amount || amount <= 0) {
            return res.json({ success: false, message: "Invalid recharge details" });
        }

        const user = await User.findOne({ username });
        if (!user) return res.json({ success: false, message: "User not found" });

        if (user.balance < amount) {
            return res.json({ success: false, message: "Insufficient balance" });
        }

        user.balance -= amount;
        await user.save();

        const tx = new Transaction({
            sender: user.username,
            receiver: "Recharge - " + operator,
            amount: amount,
            description: `Mobile Recharge - ${mobileNumber}`,
            status: "Completed",
            referenceId: "REC" + Date.now().toString().slice(-6)
        });
        await tx.save();

        return res.json({ success: true, message: "Recharge successful", data: tx });
    } catch (error) {
        console.error("Recharge error:", error);
        return res.json({ success: false, message: "Recharge failed" });
    }
});

// =============================
// GET TRANSACTIONS
// =============================
app.get("/transactions/:username", async (req, res) => {
    try {
        const username = normalizeUsername(req.params.username);
        
        const transactions = await Transaction.find({
            $or: [{ sender: username }, { receiver: username }]
        }).sort({ createdAt: -1 });

        return res.json({ success: true, data: transactions });
    } catch (error) {
        console.error("Fetch transactions error:", error);
        return res.json({ success: false, message: "Failed to fetch transactions" });
    }
});

// =============================
// APPLY LOAN
// =============================
app.post("/apply-loan", async (req, res) => {
    try {
        let { username, loanType, amount, income, employmentStatus, purpose } = req.body;
        username = normalizeUsername(username);
        amount = Number(amount);

        if (!username || !loanType || !amount || amount <= 0) {
            return res.json({ success: false, message: "Invalid loan details" });
        }

        const loan = new Loan({ 
            username, 
            loanType, 
            amount,
            applicationData: { income, employmentStatus, purpose }
        });
        await loan.save();

        return res.json({ success: true, message: "Loan application submitted successfully" });
    } catch (error) {
        console.error("Loan application error:", error);
        return res.json({ success: false, message: "Loan application failed" });
    }
});

// =============================
// GET LOANS
// =============================
app.get("/loans/:username", async (req, res) => {
    try {
        const username = normalizeUsername(req.params.username);
        const loans = await Loan.find({ username }).sort({ createdAt: -1 });
        return res.json({ success: true, data: loans });
    } catch (error) {
        console.error("Fetch loans error:", error);
        return res.json({ success: false, message: "Failed to fetch loans" });
    }
});

// =============================
// GET ALL USERS (FOR ADMIN & P2P)
// =============================
app.get("/users/all", async (req, res) => {
    try {
        const users = await User.find({}, 'username email phone balance');
        return res.json({ success: true, data: users });
    } catch (error) {
        return res.json({ success: false, message: "Failed to fetch users" });
    }
});

// =============================
// MONEY REQUESTS (P2P)
// =============================
app.post("/request-money", async (req, res) => {
    try {
        let { requester, targetUser, amount, description } = req.body;
        requester = normalizeUsername(requester);
        targetUser = normalizeUsername(targetUser);
        amount = Number(amount);

        if (!requester || !targetUser || !amount || amount <= 0) {
            return res.json({ success: false, message: "Invalid request details" });
        }

        const request = new MoneyRequest({ requester, targetUser, amount, description });
        await request.save();

        // Add notification to target user
        await User.findOneAndUpdate(
            { username: targetUser },
            { $push: { notifications: { message: `${requester} requested ₹${amount} for ${description}`, type: "warning" } } }
        );

        return res.json({ success: true, message: "Request sent successfully" });
    } catch (error) {
        return res.json({ success: false, message: "Failed to send request" });
    }
});

app.get("/money-requests/:username", async (req, res) => {
    try {
        const username = normalizeUsername(req.params.username);
        const requests = await MoneyRequest.find({ targetUser: username, status: "Pending" });
        return res.json({ success: true, data: requests });
    } catch (error) {
        return res.json({ success: false, message: "Failed to fetch requests" });
    }
});

app.post("/handle-request", async (req, res) => {
    try {
        const { requestId, action } = req.body; // action: 'Accepted' or 'Declined'
        const request = await MoneyRequest.findById(requestId);
        if (!request || request.status !== "Pending") return res.json({ success: false, message: "Invalid request" });

        if (action === "Declined") {
            request.status = "Declined";
            await request.save();
            await User.findOneAndUpdate({ username: request.requester }, { $push: { notifications: { message: `${request.targetUser} declined your request for ₹${request.amount}`, type: "info" } } });
            return res.json({ success: true, message: "Request declined" });
        }

        if (action === "Accepted") {
            const sender = await User.findOne({ username: request.targetUser });
            const receiver = await User.findOne({ username: request.requester });

            if (sender.balance < request.amount) return res.json({ success: false, message: "Insufficient balance to accept" });

            sender.balance -= request.amount;
            receiver.balance += request.amount;
            await sender.save();
            await receiver.save();

            request.status = "Accepted";
            await request.save();

            const tx = new Transaction({
                sender: sender.username, receiver: receiver.username, amount: request.amount, description: request.description, referenceId: "NEX" + Date.now().toString().slice(-8)
            });
            await tx.save();

            await User.findOneAndUpdate({ username: request.requester }, { $push: { notifications: { message: `${request.targetUser} accepted your request for ₹${request.amount}`, type: "success" } } });

            return res.json({ success: true, message: "Request accepted and funds transferred" });
        }
    } catch (error) {
        return res.json({ success: false, message: "Failed to handle request" });
    }
});

// =============================
// NOTIFICATIONS
// =============================
app.get("/notifications/:username", async (req, res) => {
    try {
        const user = await User.findOne({ username: normalizeUsername(req.params.username) });
        if(!user) return res.json({success: false});
        return res.json({ success: true, data: user.notifications.filter(n => !n.read) });
    } catch (error) { return res.json({ success: false }); }
});

app.post("/notifications/:username/read", async (req, res) => {
    try {
        await User.updateOne(
            { username: normalizeUsername(req.params.username) },
            { $set: { "notifications.$[].read": true } }
        );
        return res.json({ success: true });
    } catch (error) { return res.json({ success: false }); }
});

// =============================
// ADMIN ROUTES
// =============================
app.get("/admin/transactions", async (req, res) => {
    try {
        const txs = await Transaction.find().sort({ createdAt: -1 });
        return res.json({ success: true, data: txs });
    } catch (error) { return res.json({ success: false }); }
});

app.get("/admin/loans", async (req, res) => {
    try {
        const loans = await Loan.find({ status: "Pending" }).sort({ createdAt: -1 });
        return res.json({ success: true, data: loans });
    } catch (error) { return res.json({ success: false }); }
});

app.post("/admin/loans/:id/handle", async (req, res) => {
    try {
        const { action } = req.body; // 'Approved' or 'Rejected'
        const loan = await Loan.findById(req.params.id);
        if(!loan || loan.status !== "Pending") return res.json({ success: false, message: "Invalid loan" });

        loan.status = action;
        await loan.save();

        if (action === "Approved") {
            const user = await User.findOne({ username: loan.username });
            if (!user) return res.json({ success: false, message: "User not found" });

            user.balance = (user.balance || 0) + loan.amount;
            if (!user.notifications) user.notifications = [];
            
            user.notifications.push({ message: `Your ${loan.loanType} for ₹${loan.amount} was Approved! Funds deposited.`, type: "success" });
            await user.save();

            const tx = new Transaction({
                sender: "Bank", receiver: user.username, amount: loan.amount, description: "Loan Disbursement", referenceId: "LOAN" + Date.now().toString().slice(-6)
            });
            await tx.save();
        } else {
            await User.findOneAndUpdate({ username: loan.username }, { $push: { notifications: { message: `Your ${loan.loanType} application was Rejected.`, type: "danger" } } });
        }

        return res.json({ success: true, message: `Loan ${action}` });
    } catch (error) { return res.json({ success: false }); }
});

