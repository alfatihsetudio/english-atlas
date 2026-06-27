export const GRAMMAR_FORMULAS: Record<string, {
  verbal: { positive: string; negative: string; interrogative: string; };
  nominal: { positive: string; negative: string; interrogative: string; };
}> = {
  "Present Simple": {
    verbal: {
      positive: "S + V1(s/es) + O",
      negative: "S + do/does + not + V1 + O",
      interrogative: "Do/Does + S + V1 + O + ?"
    },
    nominal: {
      positive: "S + is/am/are + N/A",
      negative: "S + is/am/are + not + N/A",
      interrogative: "Is/Am/Are + S + N/A + ?"
    }
  },
  "Past Simple": {
    verbal: {
      positive: "S + V2 + O",
      negative: "S + did + not + V1 + O",
      interrogative: "Did + S + V1 + O + ?"
    },
    nominal: {
      positive: "S + was/were + N/A",
      negative: "S + was/were + not + N/A",
      interrogative: "Was/Were + S + N/A + ?"
    }
  },
  "Future Simple": {
    verbal: {
      positive: "S + will + V1",
      negative: "S + will + not + V1",
      interrogative: "Will + S + V1 + ?"
    },
    nominal: {
      positive: "S + will + be + N/A",
      negative: "S + will + not + be + N/A",
      interrogative: "Will + S + be + N/A + ?"
    }
  },
  "Present Continuous": {
    verbal: {
      positive: "S + is/am/are + V-ing",
      negative: "S + is/am/are + not + V-ing",
      interrogative: "Is/Am/Are + S + V-ing + ?"
    },
    nominal: {
      positive: "S + is/am/are + being + N/A",
      negative: "S + is/am/are + not + being + N/A",
      interrogative: "Is/Am/Are + S + being + N/A + ?"
    }
  },
  "Past Continuous": {
    verbal: {
      positive: "S + was/were + V-ing",
      negative: "S + was/were + not + V-ing",
      interrogative: "Was/Were + S + V-ing + ?"
    },
    nominal: {
      positive: "S + was/were + being + N/A",
      negative: "S + was/were + not + being + N/A",
      interrogative: "Was/Were + S + being + N/A + ?"
    }
  },
  "Future Continuous": {
    verbal: {
      positive: "S + will + be + V-ing",
      negative: "S + will + not + be + V-ing",
      interrogative: "Will + S + be + V-ing + ?"
    },
    nominal: {
      positive: "S + will + be + being + N/A",
      negative: "S + will + not + be + being + N/A",
      interrogative: "Will + S + be + being + N/A + ?"
    }
  },
  "Present Perfect": {
    verbal: {
      positive: "S + have/has + V3",
      negative: "S + have/has + not + V3",
      interrogative: "Have/Has + S + V3 + ?"
    },
    nominal: {
      positive: "S + have/has + been + N/A",
      negative: "S + have/has + not + been + N/A",
      interrogative: "Have/Has + S + been + N/A + ?"
    }
  },
  "Past Perfect": {
    verbal: {
      positive: "S + had + V3",
      negative: "S + had + not + V3",
      interrogative: "Had + S + V3 + ?"
    },
    nominal: {
      positive: "S + had + been + N/A",
      negative: "S + had + not + been + N/A",
      interrogative: "Had + S + been + N/A + ?"
    }
  },
  "Future Perfect": {
    verbal: {
      positive: "S + will + have + V3",
      negative: "S + will + not + have + V3",
      interrogative: "Will + S + have + V3 + ?"
    },
    nominal: {
      positive: "S + will + have + been + N/A",
      negative: "S + will + not + have + been + N/A",
      interrogative: "Will + S + have + been + N/A + ?"
    }
  },
  "Present Perfect Continuous": {
    verbal: {
      positive: "S + have/has + been + V-ing",
      negative: "S + have/has + not + been + V-ing",
      interrogative: "Have/Has + S + been + V-ing + ?"
    },
    nominal: {
      positive: "S + have/has + been + being + N/A (Jarang digunakan)",
      negative: "S + have/has + not + been + being + N/A (Jarang digunakan)",
      interrogative: "Have/Has + S + been + being + N/A + ? (Jarang digunakan)"
    }
  },
  "Past Perfect Continuous": {
    verbal: {
      positive: "S + had + been + V-ing",
      negative: "S + had + not + been + V-ing",
      interrogative: "Had + S + been + V-ing + ?"
    },
    nominal: {
      positive: "S + had + been + being + N/A (Jarang digunakan)",
      negative: "S + had + not + been + being + N/A (Jarang digunakan)",
      interrogative: "Had + S + been + being + N/A + ? (Jarang digunakan)"
    }
  },
  "Future Perfect Continuous": {
    verbal: {
      positive: "S + will + have + been + V-ing",
      negative: "S + will + not + have + been + V-ing",
      interrogative: "Will + S + have + been + V-ing + ?"
    },
    nominal: {
      positive: "S + will + have + been + being + N/A (Jarang digunakan)",
      negative: "S + will + not + have + been + being + N/A (Jarang digunakan)",
      interrogative: "Will + S + have + been + being + N/A + ? (Jarang digunakan)"
    }
  }
};
