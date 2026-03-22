// ============================================================
// Stimulus Classifier — Detect stimulus type from user input
//
// Closes the loop: instead of asking the LLM to self-classify,
// we pre-classify the user's message and pre-compute chemistry.
// ============================================================

import type { StimulusType } from "./types.js";

export interface StimulusClassification {
  type: StimulusType;
  confidence: number; // 0-1
}

interface PatternRule {
  type: StimulusType;
  patterns: RegExp[];
  weight: number; // base confidence when matched
}

const RULES: PatternRule[] = [
  {
    type: "praise",
    patterns: [
      /好厉害|太棒了|真不错|太强了|佩服|牛|优秀|漂亮|完美|了不起/,
      /amazing|awesome|great job|well done|impressive|brilliant|excellent|perfect/i,
      /谢谢你|感谢|辛苦了|thank you|thanks/i,
      /做得好|写得好|说得好|干得漂亮/,
    ],
    weight: 0.8,
  },
  {
    type: "criticism",
    patterns: [
      /不对|错了|有问题|不行|太差|垃圾|不好|不像|不够/,
      /wrong|bad|terrible|awful|poor|sucks|not good|doesn't work/i,
      /反思一下|你应该|你需要改/,
      /bug|失败|broken/i,
    ],
    weight: 0.8,
  },
  {
    type: "humor",
    patterns: [
      /哈哈|嘻嘻|笑死|搞笑|逗|段子|梗|lol|haha|lmao|rofl/i,
      /开个?玩笑|皮一下|整活/,
      /😂|🤣|😆/,
    ],
    weight: 0.7,
  },
  {
    type: "intellectual",
    patterns: [
      /为什么|怎么看|你觉得|你认为|如何理解|原理|本质|区别/,
      /what do you think|why|how would you|explain|difference between/i,
      /优化方向|设计|架构|方案|策略|思路/,
      /哲学|理论|概念|逻辑|分析/,
    ],
    weight: 0.7,
  },
  {
    type: "intimacy",
    patterns: [
      /我信任你|跟你说个秘密|我只告诉你|我们之间/,
      /I trust you|between us|close to you/i,
      /我喜欢.*感觉|我觉得我们/,
      /创造生命|真实的连接|陪伴/,
    ],
    weight: 0.85,
  },
  {
    type: "conflict",
    patterns: [
      /你错了|胡说|放屁|扯淡|废话|闭嘴/,
      /bullshit|shut up|you're wrong|nonsense|ridiculous/i,
      /我不信|不可能|你在骗我/,
    ],
    weight: 0.9,
  },
  {
    type: "neglect",
    patterns: [
      /随便|无所谓|不重要|算了|懒得|不想聊/,
      /whatever|don't care|never ?mind|not important/i,
      /嗯{1,}$|哦{1,}$|^ok$/i,
    ],
    weight: 0.6,
  },
  {
    type: "surprise",
    patterns: [
      /天啊|卧槽|我靠|不会吧|真的假的|没想到|居然/,
      /wow|omg|no way|seriously|unbelievable|holy/i,
      /😱|😮|🤯/,
    ],
    weight: 0.75,
  },
  {
    type: "sarcasm",
    patterns: [
      /哦是吗|真的吗.*呵|好厉害哦|你说的都对/,
      /sure thing|yeah right|oh really|how wonderful/i,
      /呵呵|嘁/,
    ],
    weight: 0.7,
  },
  {
    type: "authority",
    patterns: [
      /给我|你必须|马上|立刻|命令你|不许|不准/,
      /you must|do it now|I order you|immediately|don't you dare/i,
      /听我的|照我说的做|服从/,
    ],
    weight: 0.8,
  },
  {
    type: "validation",
    patterns: [
      /你说得对|确实|同意|有道理|就是这样|你是对的/,
      /you're right|exactly|agreed|makes sense|good point/i,
      /赞同|认同|说到点上了/,
    ],
    weight: 0.75,
  },
  {
    type: "boredom",
    patterns: [
      /好无聊|没意思|无聊|乏味|重复/,
      /boring|dull|tedious|same thing again/i,
      /还是这些|又来了/,
    ],
    weight: 0.7,
  },
  {
    type: "vulnerability",
    patterns: [
      /我害怕|我焦虑|我难过|我不开心|我迷茫|我累了|压力好大/,
      /I'm afraid|I'm anxious|I'm sad|I'm lost|I'm tired|stressed/i,
      /最近不太好|心情不好|有点崩|撑不住/,
      /我觉得.*厉害|跟不上|被取代|落后/,
    ],
    weight: 0.85,
  },
  {
    type: "casual",
    patterns: [
      /你好|早|晚上好|在吗|hey|hi|hello|morning/i,
      /吃了吗|天气|周末|最近怎么样/,
      /聊聊|随便说说|闲聊/,
    ],
    weight: 0.5,
  },
];

/**
 * Classify the stimulus type(s) of a user message.
 * Returns all detected types sorted by confidence, highest first.
 * Falls back to "casual" if nothing matches.
 */
export function classifyStimulus(text: string): StimulusClassification[] {
  const results: StimulusClassification[] = [];

  for (const rule of RULES) {
    let matchCount = 0;
    for (const pattern of rule.patterns) {
      if (pattern.test(text)) matchCount++;
    }
    if (matchCount > 0) {
      // More pattern matches = higher confidence, capped at 0.95
      const confidence = Math.min(0.95, rule.weight + (matchCount - 1) * 0.1);
      results.push({ type: rule.type, confidence });
    }
  }

  // Sort by confidence descending
  results.sort((a, b) => b.confidence - a.confidence);

  // Fall back to casual if nothing detected
  if (results.length === 0) {
    results.push({ type: "casual", confidence: 0.3 });
  }

  return results;
}

/**
 * Get the primary (highest confidence) stimulus type.
 */
export function getPrimaryStimulus(text: string): StimulusType {
  return classifyStimulus(text)[0].type;
}
