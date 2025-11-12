export declare class Email {
    id: string;
    to: string;
    subject: string;
    text: string;
    html: string;
    status: 'pending' | 'sent' | 'failed';
    created_at: Date;
}
