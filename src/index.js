/**
 * ai-memory-context
 * Sliding-window memory management with auto-summarization for AI conversations.
 * @module ai-memory-context
 */

class AIMemoryContext {
  constructor(options = {}) {
    this.callAI = options.callAI; // async (prompt, system) => string
    this.maxTokens = options.maxTokens || 8000;
    this.summaryThreshold = options.summaryThreshold || 0.75;
    this.entries = [];
    this.summaries = [];
    this.totalEstimatedTokens = 0;
    if (!this.callAI) throw new Error('callAI function is required');
  }

  _estimateTokens(text) {
    return Math.ceil(text.length / 3.5);
  }

  add(role, content, metadata = {}) {
    const tokens = this._estimateTokens(content);
    this.entries.push({ role, content, tokens, metadata, timestamp: Date.now() });
    this.totalEstimatedTokens += tokens;
    return this;
  }

  async getContext() {
    const threshold = this.maxTokens * this.summaryThreshold;
    if (this.totalEstimatedTokens > threshold) {
      await this._compactMemory();
    }
    return this._buildContextString();
  }

  async _compactMemory() {
    const target = Math.floor(this.maxTokens * 0.5);
    const toSummarize = [];
    let removedTokens = 0;

    while (this.entries.length > 2 && this.totalEstimatedTokens - removedTokens > target) {
      const entry = this.entries.shift();
      toSummarize.push(entry);
      removedTokens += entry.tokens;
    }
    this.totalEstimatedTokens -= removedTokens;

    if (toSummarize.length > 0) {
      const text = toSummarize.map(e => e.role + ': ' + e.content).join('\n');
      const summary = await this.callAI(
        'Summarize this conversation history concisely, preserving key facts, decisions, and context:\n\n' + text,
        'You are a precise summarizer. Keep all important details.'
      );
      const summaryTokens = this._estimateTokens(summary);
      this.summaries.push({ content: summary, tokens: summaryTokens, entriesCount: toSummarize.length });
      this.totalEstimatedTokens += summaryTokens;
    }
  }

  _buildContextString() {
    let context = '';
    if (this.summaries.length > 0) {
      context += '[CONVERSATION SUMMARY]\n';
      context += this.summaries.map(s => s.content).join('\n---\n');
      context += '\n[END SUMMARY]\n\n';
    }
    context += this.entries.map(e => e.role + ': ' + e.content).join('\n');
    return context;
  }

  getStats() {
    return {
      entries: this.entries.length,
      summaries: this.summaries.length,
      estimatedTokens: this.totalEstimatedTokens,
      maxTokens: this.maxTokens
    };
  }

  clear() {
    this.entries = [];
    this.summaries = [];
    this.totalEstimatedTokens = 0;
  }
}

module.exports = AIMemoryContext;