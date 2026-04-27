const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    voicePhrase: { type: String, required: true },

    accountNumber: { type: String, default: "519576578364" },
    ifsc: { type: String, default: "SBIN0000456" },
    branch: { type: String, default: "Habshiguda Branch" },
    branchCode: { type: String, default: "4567" },

    email: { type: String, default: "" },
    phone: { type: String, default: "" },

    balance: { type: Number, default: 0 },
    notifications: [{
        message: String,
        type: { type: String, default: "info" },
        read: { type: Boolean, default: false }
    }]

}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);