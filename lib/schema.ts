import { z } from "zod";

export const formSchema = z.object({
  // Step 1: Settings
  language: z.enum(["English", "German"]).default("English"),
  source: z.enum(["Recommendation", "Website"]).default("Website"),
  contractDate: z.string().min(1, "Contract date is required."),
  clientType: z.enum(["private", "business"]).default("private"),
  
  // Step 2: Client Info
  firstName: z.string().min(1, "First name is required."),
  lastName: z.string().min(1, "Last name is required."),
  email: z.string().email("Invalid email address."),
  phone: z.string().min(1, "Phone number is required."),
  address: z.string().min(1, "Address is required."),
  companyName: z.string().optional(),
  companyAddress: z.string().optional(),

  // Step 3: Course Info
  program: z.string().default("Private tuition"),
  courseLang: z.enum(["German", "Spanish"]).default("German"),
  level: z.string().min(1, "Level is required."),
  lessonType: z.string().min(1, "Lesson type is required."),
  totalHours: z.coerce.number().min(1, "Must be at least 1 hour."),
  pricePerHour: z.coerce.number().min(1, "Price must be greater than 0."),
  hoursPerLesson: z.enum(["45", "60", "90", "120"]).default("60"),
  discount: z.coerce.number().min(0, "Discount cannot be negative.").default(0),
  scheduleText: z.string().min(1, "Schedule is required."),
  
  // Step 4: Billing & Dates
  courseStart: z.string().min(1, "Course start date is required."),
  courseEnd: z.string().min(1, "Course end date is required."),
  validUntil: z.string().min(1, "Validity date is required."),
  pay1Date: z.string().min(1, "Payment 1 date is required."),
  pay1Amount: z.coerce.number().min(1, "Payment 1 amount is required."),
  pay2Date: z.string().optional(),
  pay2Amount: z.coerce.number().optional(),
  pay3Date: z.string().optional(),
  pay3Amount: z.coerce.number().optional(),
}).superRefine((data, ctx) => {
  // Conditional validation for business clients
  if (data.clientType === 'business') {
    if (!data.companyName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['companyName'],
        message: 'Company name is required for business clients.',
      });
    }
    if (!data.companyAddress) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['companyAddress'],
        message: 'Company address is required for business clients.',
      });
    }
  }

  // Date logic validation
  if (data.courseStart && data.courseEnd) {
    const courseStartDate = new Date(data.courseStart);
    const courseEndDate = new Date(data.courseEnd);
    if (courseEndDate <= courseStartDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['courseEnd'],
        message: 'Course end date must be after the start date.',
      });
    }
  }

  if (data.courseEnd && data.validUntil) {
    const courseEndDate = new Date(data.courseEnd);
    const validUntilDate = new Date(data.validUntil);
    if (validUntilDate <= courseEndDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['validUntil'],
        message: '"Valid until" date must be after the course end date.',
      });
    }
  }
});

export type FormData = z.infer<typeof formSchema>;