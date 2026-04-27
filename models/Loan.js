const mongoose = require("mongoose");

const loanSchema = new mongoose.Schema({
    username: { type: String, required: true },
    loanType: { type: String, required: true },
    amount: { type: Number, required: true },
    applicationData: {
        income: { type: String },
        employmentStatus: { type: String },
        purpose: { type: String }
    },
    status: { type: String, default: "Pending" }, // Pending, Approved, Rejected
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Loan", loanSchema);
