const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/software_retirement')
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => console.log('MongoDB error:', err));

// System Schema
const systemSchema = new mongoose.Schema({
  name: String,
  organization: String,
  purchase_year: Number,
  last_updated: Number,
  vendor: String,
  language: String,
  users: Number,
  created_at: { type: Date, default: Date.now }
});

// Evaluation Schema
const evaluationSchema = new mongoose.Schema({
  system_id: { type: mongoose.Schema.Types.ObjectId, ref: 'System' },
  technical_score: Number,
  business_score: Number,
  total_score: Number,
  recommendation: String,
  answers: Object,
  created_at: { type: Date, default: Date.now }
});

const System = mongoose.model('System', systemSchema);
const Evaluation = mongoose.model('Evaluation', evaluationSchema);

// GET all history
app.get('/api/history', async (req, res) => {
  try {
    const evaluations = await Evaluation.find()
      .populate('system_id')
      .sort({ created_at: -1 });

    const result = evaluations.map(e => ({
      id: e._id,
      name: e.system_id?.name,
      organization: e.system_id?.organization,
      technical_score: e.technical_score,
      business_score: e.business_score,
      total_score: e.total_score,
      recommendation: e.recommendation,
      created_at: e.created_at
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single result
app.get('/api/results/:id', async (req, res) => {
  try {
    const evaluation = await Evaluation.findById(req.params.id).populate('system_id');
    if (!evaluation) return res.status(404).json({ error: 'Not found' });
    res.json({
      ...evaluation.toObject(),
      name: evaluation.system_id?.name,
      organization: evaluation.system_id?.organization
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST new evaluation
app.post('/api/evaluate', async (req, res) => {
  try {
    const { system, answers } = req.body;

    // Save system
    const newSystem = new System(system);
    await newSystem.save();

    // Calculate scores
    const technicalKeys = ['performance','security','maintainability','scalability',
                           'reliability','integration','documentation','tech_debt'];
    const businessKeys = ['cost','roi','user_satisfaction','strategic_fit',
                          'compliance','vendor_support','business_continuity','competitive_advantage'];

    let techTotal = 0, busTotal = 0;
    technicalKeys.forEach(k => { techTotal += (answers[k] || 0); });
    businessKeys.forEach(k => { busTotal += (answers[k] || 0); });

    const maxScore = 5 * 8;
    const technicalScore = parseFloat(((techTotal / maxScore) * 100).toFixed(1));
    const businessScore = parseFloat(((busTotal / maxScore) * 100).toFixed(1));
    const totalScore = parseFloat(((technicalScore + businessScore) / 2).toFixed(1));

    let recommendation;
    if (totalScore >= 70) recommendation = 'MAINTAIN';
    else if (totalScore >= 45) recommendation = 'MODERNIZE';
    else recommendation = 'RETIRE';

    // Save evaluation
    const evaluation = new Evaluation({
      system_id: newSystem._id,
      technical_score: technicalScore,
      business_score: businessScore,
      total_score: totalScore,
      recommendation,
      answers
    });
    await evaluation.save();

    res.json({
      id: evaluation._id,
      technical_score: technicalScore,
      business_score: businessScore,
      total_score: totalScore,
      recommendation
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE evaluation
app.delete('/api/evaluations/:id', async (req, res) => {
  try {
    await Evaluation.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => console.log('Server running at http://localhost:3000'));