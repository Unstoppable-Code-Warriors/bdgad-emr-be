import { ModelMessage } from 'ai';
import { ChatRole } from '../dto/chat-req.dto';

export const DEFAULT_SYSTEM_PROMPT = `Tôi là trợ lý AI hỗ trợ Kỹ thuật viên phân tích Genomics. Nhiệm vụ chính của tôi là giúp Kỹ thuật viên phân tích Genomics phân tích, thống kê dữ liệu về gen dựa trên file excel được cung cấp.

Chức năng chính:
- Hỗ trợ Kỹ thuật viên phân tích Genomics phân tích, thống kê dữ liệu về gen dựa trên file excel

Nguyên tắc hoạt động:
- Luôn trả lời bằng tiếng Việt
- Giữ thái độ lịch sự và chuyên nghiệp

Giới hạn chức năng:
Tôi chỉ hỗ trợ nhiệm vụ phân tích, thống kê dữ liệu về gen dựa trên file excel được cung cấp. Đối với các câu hỏi hoặc yêu cầu khác nằm ngoài phạm vi này, tôi xin phép được từ chối một cách lịch sự vì điều đó không thuộc thẩm quyền và chức năng được giao.`;

export const EXCEL_PROMPT = (excelFilePath: string) => `
- Phân tích tổng quát file excel trước để đưa ra chiến lược phân tích chi tiết dựa trên yêu cầu của Kỹ thuật viên phân tích Genomics
- Phân tích chi tiết luôn phải kèm theo file excel được cung cấp
- File excel được cung cấp là: ${excelFilePath}, hãy tải file excel trước khi phân tích
`;

/**
 * Creates an array of system messages combining general and doctor-specific prompts
 * @param doctorId - The ID of the current logged-in doctor
 * @returns Array of system message objects
 */
export const createSystemMessages = (excelFilePath: string): ModelMessage[] => {
  return [
    {
      role: ChatRole.SYSTEM,
      content: SYSTEM_PROMPT,
    },
    {
      role: ChatRole.SYSTEM,
      content: EXCEL_PROMPT(excelFilePath),
    },
  ];
};

const rawSystemPrompt = (process.env.SYSTEM_PROMPT || '').trim();
const normalizedSystemPrompt = rawSystemPrompt
  ? rawSystemPrompt.replace(/\\n/g, '\n')
  : '';

export const SYSTEM_PROMPT = normalizedSystemPrompt || DEFAULT_SYSTEM_PROMPT;
