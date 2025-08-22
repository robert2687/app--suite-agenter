export interface AgentConfig {
  name: string;
  systemInstruction: string;
  tools: {
    useCalculator: boolean;
    useSearch: boolean;
  };
}

export interface Source {
  title: string;
  uri: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  sources?: Source[];
}

export interface AnalysisResult {
  answer: string;
  summary: string;
  keyFindings: string[];
}

// --- AI Digital Twin Types ---

export interface PromptTemplate {
    name: string;
    template: string;
    variables: string[];
}

export interface LLMConfig {
    modelName: string;
    temperature: number;
    maxTokens: number;
    topP: number;
}

export interface DecisionRule {
    name: string;
    condition: string;
    actionType: 'LLM_CALL' | 'FIXED_RESPONSE' | 'PLAN_EXECUTION' | 'MEMORY_QUERY' | 'TOOL_USE';
    actionPayload: any;
    priority: number;
}

export interface RLModelParameters {
    stateSpace: { name: string; dimensions: Record<string, string>; };
    actionSpace: { name: string; actions: string[]; };
    rewardFunction: { description: string; logic: string; };
    learnedPolicyWeights: Record<string, number>;
    explorationRate: number;
    learningRate: number;
    discountFactor: number;
}

export interface PlanningAction {
    name: string;
    preconditions: string[];
    effects: string[];
    actionType: 'LLM_CALL' | 'TOOL_USE' | 'INTERNAL_OPERATION';
    payload?: any;
}

export interface LongTermMemoryEntry {
    id: string;
    content: string;
    embedding?: number[];
    metadata?: Record<string, any>;
}

export interface ShortTermMemoryEntry {
    timestamp: number;
    role: 'user' | 'agent';
    content: string;
    sentiment?: string;
    keywords?: string[];
}

export interface DigitalTwinState {
    id: string;
    name: string;
    description: string;
    promptEngineering: {
        templates: PromptTemplate[];
        llmConfig: LLMConfig;
    };
    decisionLogic: {
        rules: DecisionRule[];
    };
    reinforcementLearning: {
        enabled: boolean;
        modelParams?: RLModelParameters;
        currentExperienceBuffer: Array<{
            state: Record<string, any>;
            action: string;
            reward: number;
            nextState: Record<string, any>;
        }>;
    };
    planning: {
        enabled: boolean;
        availableActions?: PlanningAction[];
        currentGoal?: string;
        activePlan?: string[];
        planExecutionState?: 'IDLE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
    };
    memory: {
        shortTermMemory: ShortTermMemoryEntry[];
        longTermMemory: {
            entries: LongTermMemoryEntry[];
            vectorDBConfig?: { endpoint: string; collection: string; };
        };
    };
    currentInput?: string;
    currentOutput?: string;
    currentStateContext: Record<string, any>;
    lastDecisionPath: string[];
    performanceMetrics: {
        totalInteractions: number;
        successfulInteractions: number;
        avgResponseTimeMs: number;
    };
}

export interface IAI_Agent_DigitalTwin {
    configureAgent(config: Partial<DigitalTwinState>): DigitalTwinState;
    processInteraction(input: string, environmentFeedback?: { reward?: number; success?: boolean; failure?: boolean; }): { output: string; updatedState: DigitalTwinState };
    getTwinState(): DigitalTwinState;
    resetOperationalState(): DigitalTwinState;
}
