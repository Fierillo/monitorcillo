export type FeedbackSurface = 'general_table' | 'chart';

export type FeedbackContext = {
    surface: FeedbackSurface;
    path: string;
    metricId?: string;
    metricTitle?: string;
    chartTitle?: string;
    viewId?: string;
    viewTitle?: string;
    modeId?: string;
    modeTitle?: string;
};

export type FeedbackSubmission = {
    message: string;
    context: FeedbackContext;
};

export type FeedbackRecord = FeedbackContext & {
    id: number;
    message: string;
    createdAt: string;
};
