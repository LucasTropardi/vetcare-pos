export type Role = "ADMIN" | "VET" | "RECEPTION";

export type PageResponse<T> = {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
};

export type UserResponseWithRole = {
  id: number;
  name: string;
  email: string;
  role: Role;
  active: boolean;
};

export type AppointmentType = "VET" | "PETSHOP";
export type AppointmentStatus = "OPEN" | "FINISHED" | "CANCELED";

export type AppointmentResponse = {
  id: number;
  petId: number;
  appointmentType: AppointmentType;
  veterinarianUserId?: number | null;
  serviceProductId?: number | null;
  status: AppointmentStatus;
  scheduledStartAt: string;
  scheduledEndAt: string;
  notes?: string | null;
  openedAt: string;
  finishedAt?: string | null;
  canceledAt?: string | null;
  cancelReason?: string | null;
  createdBy?: number | null;
  finishedBy?: number | null;
  canceledBy?: number | null;
  createdAt: string;
  updatedAt: string;
};

export type OpenAppointmentRequest = {
  petId: number;
  appointmentType: AppointmentType;
  veterinarianUserId?: number;
  serviceProductId?: number;
  scheduledStartAt: string;
  scheduledEndAt: string;
  notes?: string;
  chiefComplaint?: string;
};

export type MedicalRecordResponse = {
  id: number;
  appointmentId: number;
  chiefComplaint?: string | null;
  clinicalNotes?: string | null;
  attendedByUserId?: number | null;
  weightKg?: number | null;
  temperatureC?: number | null;
  heartRateBpm?: number | null;
  respiratoryRateRpm?: number | null;
  initialAssessment?: string | null;
  diagnosisSummary?: string | null;
  treatmentPlan?: string | null;
  usedMedications?: string | null;
  hospitalizationIndicated?: boolean | null;
  hospitalizationNotes?: string | null;
  dischargeInstructions?: string | null;
  followUpAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UpsertMedicalRecordRequest = {
  chiefComplaint?: string;
  clinicalNotes?: string;
  weightKg?: number;
  temperatureC?: number;
  heartRateBpm?: number;
  respiratoryRateRpm?: number;
  initialAssessment?: string;
  diagnosisSummary?: string;
  treatmentPlan?: string;
  usedMedications?: string;
  hospitalizationIndicated?: boolean;
  hospitalizationNotes?: string;
  dischargeInstructions?: string;
  followUpAt?: string;
};

export type DiagnosisResponse = {
  id: number;
  medicalRecordId: number;
  code?: string | null;
  description: string;
  primary: boolean;
  createdAt: string;
};

export type ProcedureResponse = {
  id: number;
  medicalRecordId: number;
  description: string;
  notes?: string | null;
  performedAt?: string | null;
  createdAt: string;
};

export type PetshopRecordResponse = {
  id: number;
  appointmentId: number;
  attendedByUserId?: number | null;
  serviceReport?: string | null;
  productsUsed?: string | null;
  checkinNotes?: string | null;
  checkoutNotes?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UpsertPetshopRecordRequest = {
  serviceReport?: string;
  productsUsed?: string;
  checkinNotes?: string;
  checkoutNotes?: string;
  startedAt?: string;
  finishedAt?: string;
};

export type PrescriptionItemResponse = {
  id: number;
  medicationName: string;
  dosage?: string | null;
  frequency?: string | null;
  duration?: string | null;
  route?: string | null;
  notes?: string | null;
};

export type PrescriptionResponse = {
  id: number;
  appointmentId: number;
  veterinarianUserId: number;
  title?: string | null;
  guidance?: string | null;
  validUntil?: string | null;
  createdAt: string;
  items: PrescriptionItemResponse[];
};

export type CreatePrescriptionItemRequest = {
  medicationName: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  route?: string;
  notes?: string;
};

export type CreatePrescriptionRequest = {
  title?: string;
  guidance?: string;
  validUntil?: string;
  items: CreatePrescriptionItemRequest[];
};

export type PetListItemResponse = {
  id: number;
  tutorId: number;
  tutorName?: string;
  name: string;
  species: string;
  active: boolean;
};

export type PetStatsResponse = {
  total: number;
  active: number;
  inactive: number;
  dogs: number;
  cats: number;
  others: number;
};

export type TutorListItemResponse = {
  id: number;
  name: string;
  document?: string;
  phone?: string;
  email?: string;
  active: boolean;
};

export type TutorResponse = {
  id: number;
  name: string;
  document?: string | null;
  phone?: string | null;
  email?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TutorStatsResponse = {
  total: number;
  active: number;
  inactive: number;
  withCompany: number;
  withPet: number;
  withoutContact: number;
};

export type ProductListItemResponse = {
  id: number;
  sku: string;
  name: string;
  active: boolean;
};

export type ItemType = "PRODUCT" | "SERVICE";

export type StockMovementType = "ENTRY_PURCHASE" | "EXIT_SALE" | "EXIT_VISIT_CONSUMPTION" | "ADJUSTMENT";

export type StockBalanceListItemResponse = {
  productId: number;
  sku: string;
  name: string;
  onHand: number;
  avgCost: number;
  minStock: number;
  belowMinStock: boolean;
};

export type StockMovementResponse = {
  id: number;
  productId: number;
  movementType: StockMovementType;
  quantity: number;
  unitCost?: number | null;
  notes?: string | null;
  referenceType?: string | null;
  referenceId?: number | null;
  createdBy?: number | null;
  createdAt: string;
};

export type CreateStockMovementRequest = {
  productId: number;
  movementType: StockMovementType;
  quantity: number;
  unitCost?: number;
  notes?: string;
  referenceType?: string;
  referenceId?: number;
};

export type CompanyProfileResponse = {
  id: number;
  legalName: string;
  tradeName?: string | null;
  cnpj?: string | null;
  phone?: string | null;
  email?: string | null;
  headquarter: boolean;
  parentCompanyId?: number | null;
  createdAt: string;
  updatedAt: string;
};

export type CashRegisterStatus = "OPEN" | "CLOSED" | "CANCELED";

export type CashRegisterResponse = {
  id: number;
  companyId: number;
  registerCode: string;
  status: CashRegisterStatus;
  openingAmount: number;
  expectedClosingAmount: number;
  closingAmount?: number | null;
  openedBy: number;
  openedAt: string;
  closedBy?: number | null;
  closedAt?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OpenCashRegisterRequest = {
  companyId: number;
  registerCode: string;
  openingAmount: number;
  expectedClosingAmount?: number;
  notes?: string;
};

export type ProductPosLookupResponse = {
  id: number;
  sku: string;
  name: string;
  unit: string;
  itemType: ItemType;
  active: boolean;
  salePrice: number;
  gtinEan?: string | null;
  gtinEanTrib?: string | null;
};

export type ProductResponse = {
  id: number;
  sku: string;
  name: string;
  itemType: ItemType;
  category: string;
  unit: string;
  active: boolean;
  salePrice: number;
  costPrice: number;
  minStock: number;
  fiscal?: {
    ncm?: string | null;
    cest?: string | null;
    origin?: string | null;
    gtinEan?: string | null;
    gtinEanTrib?: string | null;
    unitTrib?: string | null;
    tribFactor?: number | null;
    cbenef?: string | null;
    serviceListCode?: string | null;
  } | null;
};

export type SaleStatus = "DRAFT" | "CONFIRMED" | "CANCELED";

export type SaleItemResponse = {
  id: number;
  productId: number;
  itemType: ItemType;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  total: number;
  createdAt: string;
};

export type SalePaymentResponse = {
  id: number;
  method: "PIX" | "CARD" | "CASH" | "OTHER";
  status: "PENDING" | "PAID" | "CANCELED" | "REFUNDED";
  amount: number;
  paidAt?: string | null;
  createdBy?: number | null;
  createdAt: string;
  notes?: string | null;
};

export type SaleResponse = {
  id: number;
  companyId: number;
  tutorId?: number | null;
  customerCompanyId?: number | null;
  appointmentId?: number | null;
  status: SaleStatus;
  subtotal: number;
  discount: number;
  total: number;
  paidTotal: number;
  remaining: number;
  notes?: string | null;
  createdBy?: number | null;
  confirmedBy?: number | null;
  confirmedAt?: string | null;
  canceledBy?: number | null;
  canceledAt?: string | null;
  createdAt: string;
  updatedAt: string;
  items: SaleItemResponse[];
  payments: SalePaymentResponse[];
};

export type SaleListItemResponse = {
  id: number;
  companyId: number;
  tutorId?: number | null;
  customerCompanyId?: number | null;
  appointmentId?: number | null;
  status: SaleStatus;
  subtotal: number;
  discount: number;
  total: number;
  paidTotal: number;
  remaining: number;
  notes?: string | null;
  createdBy?: number | null;
  confirmedBy?: number | null;
  confirmedAt?: string | null;
  canceledBy?: number | null;
  canceledAt?: string | null;
  createdAt: string;
  updatedAt: string;
  itemCount?: number | null;
  customerName?: string | null;
  customerDocument?: string | null;
  registerCode?: string | null;
  saleNumber?: number | null;
  documentNumber?: string | null;
  protocol?: string | null;
  canCancel?: boolean | null;
  xmlAvailable?: boolean | null;
  receiptAvailable?: boolean | null;
};

export type CreateSaleRequest = {
  companyId: number;
  cashRegisterId: number;
  tutorId?: number;
  customerCompanyId?: number;
  appointmentId?: number;
  notes?: string;
};

export type AddSaleItemRequest = {
  productId: number;
  quantity: number;
  unitPrice?: number;
};

export type UpdateSaleRequest = {
  tutorId?: number;
  customerCompanyId?: number;
  clearRecipient?: boolean;
  notes?: string;
};

export type CheckoutPaymentRequest = {
  method: "PIX" | "CARD" | "CASH" | "OTHER";
  amount: number;
  notes?: string;
};

export type FinalizeSaleRequest = {
  tutorId?: number;
  customerCompanyId?: number;
  clearRecipient?: boolean;
  notes?: string;
  payments: CheckoutPaymentRequest[];
};

export type SaleReceiptCompanyResponse = {
  id: number;
  displayName: string;
  legalName: string;
  cnpj?: string | null;
  phone?: string | null;
};

export type SaleReceiptCustomerResponse = {
  identified: boolean;
  name: string;
  document?: string | null;
};

export type SaleReceiptItemResponse = {
  id: number;
  lineNumber: number;
  productId: number;
  itemType: ItemType;
  description: string;
  unit: string;
  ncm?: string | null;
  cfop?: string | null;
  quantity: number;
  unitPrice: number;
  total: number;
  estimatedTax: number;
};

export type SaleReceiptTaxBreakdownResponse = {
  federal: number;
  state: number;
  municipal: number;
  total: number;
};

export type SaleReceiptPaymentResponse = {
  id: number;
  method: "PIX" | "CARD" | "CASH" | "OTHER";
  status: "PENDING" | "PAID" | "CANCELED" | "REFUNDED";
  amount: number;
  notes?: string | null;
  paidAt?: string | null;
};

export type SaleReceiptResponse = {
  saleId: number;
  saleNumber: number;
  registerCode: string;
  environment: string;
  notice: string;
  documentLabel: string;
  documentNumber: string;
  series: string;
  accessKey: string;
  protocol: string;
  issuedAt: string;
  company: SaleReceiptCompanyResponse;
  customer: SaleReceiptCustomerResponse;
  items: SaleReceiptItemResponse[];
  payments: SaleReceiptPaymentResponse[];
  subtotal: number;
  discount: number;
  total: number;
  estimatedTaxes: SaleReceiptTaxBreakdownResponse;
  receivedTotal: number;
  change: number;
};

export type FinalizeSaleResponse = {
  sale: SaleResponse;
  receipt: SaleReceiptResponse;
};
