import { z } from "zod";
import { isValidPhoneNumber } from "react-phone-number-input";

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
  phone: z.string().min(1, "Phone number is required.").refine(isValidPhoneNumber, { message: "Invalid phone number." }),
  
  // Structured Client Address
  addrStreet: z.string().min(1, "Street is required."),
  addrHouse: z.string().min(1, "House number is required."),
  addrApt: z.string().optional(),
  addrCity: z.string().min(1, "City is required."),
  addrZip: z.string().min(1, "Zip code is required."),
  addrState: z.string().optional(),

  addrCountry: z.string().min(1, "Country is required."),

  // Company Info (Optional - Validated in superRefine)
  companyName: z.string().optional(),
  compStreet: z.string().optional(),
  compHouse: z.string().optional(),
  compApt: z.string().optional(),
  compCity: z.string().optional(),
  compZip: z.string().optional(),
  compState: z.string().optional(),
  compCountry: z.string().optional(),

  // Step 3: Course Info
  program: z.string().default("Private tuition"),
  courseLang: z.enum(["German", "Spanish"]).default("German"),
  
  level: z.array(z.string()).min(1, "Select at least one level."),
  
  lessons: z.array(z.object({
    type: z.enum(["Online Lessons", "Live Lessons"]),
    format: z.enum(["45", "60", "90", "120"]).default("60"),
    totalHours: z.coerce.number().min(1, "Hours required"),
    pricePerHour: z.coerce.number().min(1, "Price required"),
    schedule: z.string().min(1, "Schedule required"), 
  })).min(1, "Add at least one lesson type."),

  discount: z.coerce.number().min(0, "Discount cannot be negative.").max(100, "Discount cannot be over 100%.").default(0),

  // Step 4: Billing & Dates
  courseStart: z.string().min(1, "Course start date is required."),
  courseEnd: z.string().min(1, "Course end date is required."),
  validUntil: z.string().min(1, "Validity date is required."),

  // 👇 NEW: Dynamic Payments Array
  payments: z.array(
    z.object({
      date: z.string().min(1, "Date is required"),
      amount: z.coerce.number().min(1, "Amount is required"),
    })
  ).min(1, "At least one payment is required."),

  // 👇 CHANGED: These are now Optional (Legacy/Calculated fields)
  // We keep them in the type definition so typescript doesn't yell when we assign them in onSubmit
  pay1Date: z.string().optional(),
  pay1Amount: z.coerce.number().optional(),
  pay2Date: z.string().optional(),
  pay2Amount: z.coerce.number().optional(),
  pay3Date: z.string().optional(),
  pay3Amount: z.coerce.number().optional(),

  // Calculated Fields (Optional)
  calculatedTotalValue: z.number().optional(),
  paymentPlanString: z.string().optional(), // For Excel "2023-01-01 100; ..."
  
  // Legacy Fields (Optional)
  lessonType: z.string().optional(),
  totalHours: z.coerce.number().optional(),
  pricePerHour: z.coerce.number().optional(),
  hoursPerLesson: z.string().optional(),
  scheduleText: z.string().optional(),

}).superRefine((data, ctx) => {
  // Conditional validation for business clients
  if (data.clientType === 'business') {
    if (!data.companyName) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['companyName'], message: 'Company name is required.' });
    if (!data.compStreet) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['compStreet'], message: 'Street is required.' });
    if (!data.compHouse) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['compHouse'], message: 'House number is required.' });
    if (!data.compCity) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['compCity'], message: 'City is required.' });
    if (!data.compZip) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['compZip'], message: 'Zip code is required.' });
    if (!data.compCountry) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['compCountry'], message: 'Country is required.' });
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