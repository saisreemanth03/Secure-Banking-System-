const mongoose = require("mongoose");

const moneyRequestSchema = new mongoose.Schema({
    requester: { type: String, required: true },
    targetUser: { type: String, required: true },
    amount: { type: Number, required: true },
    description: { type: String },
    status: { type: String, default: "Pending" }, // Pending, Accepted, Declined
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("MoneyRequest", moneyRequestSchema);
