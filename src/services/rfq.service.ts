import { RFQModel } from "../models/rfq.model";
import {
  EvaluatedQuestionnaireData,
  NegotiationResponse,
  NegotiationSummary,
  RFQDocument,
  Supplier,
} from "../types/rfq";
import { AppError } from "../middleware/error";
import { sendInvitationEmail } from "../services/email.service";
import { Document, Types } from "mongoose";
import {
  RFQAnalysis,
  SupplierQuoteAnalysis,
  createAnalysisPayload,
  createSupplierQuoteForAnalysis,
  createSupplierQuotesForAnalysis,
  getLowestQuotedValueForEachItem,
} from "../utils/rfq.utils";
import { ExcelService } from "./excel.service";
import fs from "fs";
import mongoose from "mongoose";
import {
  SupplierQuoteRequestModel,
  SupplierQuoteRequestDocument,
} from "../models/supplier-quote-request.model";
import { getFromUltron } from "../utils/common.utils";

export class RFQService {
  private excelService: ExcelService;
  constructor() {
    this.excelService = new ExcelService();
  }

  async create(rfqData: any): Promise<RFQDocument> {
    try {
      // Ensure required fields are present
      if (!rfqData.title) {
        const error: any = new Error("RFQ title is required");
        error.statusCode = 400;
        throw error;
      }

      // Initialize empty arrays if they don't exist
      if (!rfqData.suppliers) {
        rfqData.suppliers = [];
      } else {
        // Ensure each supplier has an id and valid status
        rfqData.suppliers = rfqData.suppliers.map(
          (supplier: any, index: number) => {
            const updatedSupplier = { ...supplier };

            // Add ID if missing
            if (!updatedSupplier.id) {
              updatedSupplier.id = updatedSupplier._id || Date.now() + index;
            }

            // Set a valid status if 'pending' is not allowed
            if (updatedSupplier.status === "pending") {
              updatedSupplier.status = "invited"; // Use a valid status from your enum
            }

            return updatedSupplier;
          }
        );
      }

      // Ensure termsAndConditions exists with at least a timestamp
      if (!rfqData.termsAndConditions) {
        rfqData.termsAndConditions = {
          timestamp: new Date().toISOString(),
          fields: [],
          subsections: [],
        };
      } else if (!rfqData.termsAndConditions.timestamp) {
        rfqData.termsAndConditions.timestamp = new Date().toISOString();
      }

      // Create and return the RFQ
      const rfq = new RFQModel(rfqData);
      return await rfq.save();
    } catch (error: any) {
      console.error("Error creating RFQ:", error);

      // Add status code if not present
      if (!error.statusCode) {
        error.statusCode = 500;
      }
      throw error;
    }
  }

  private sendSupplierEmails = async (
    rfq: RFQDocument & { _id: Types.ObjectId }
  ) => {
    try {
      const emailPromises = rfq.suppliers?.map((supplier) =>
        sendInvitationEmail(supplier.email || "", {
          rfqId: rfq._id,
          rfqTitle: rfq.generalDetails.title,
          supplierName: supplier.name || "",
          rfqData: rfq,
        })
      );
      if (emailPromises) {
        await Promise.all(emailPromises);
      }
    } catch (error) {
      console.error("Error sending supplier emails:", error);
    }
  };

  findAll = async (): Promise<(RFQDocument & { _id: Types.ObjectId })[]> => {
    try {
      const rfqs = await RFQModel.find().sort({ createdAt: -1 });
      return rfqs.map((rfq) => rfq.toObject());
    } catch (error) {
      throw new AppError(500, "Failed to fetch RFQs");
    }
  };

  findById = async (
    id: string
  ): Promise<(RFQDocument & { _id: mongoose.Types.ObjectId }) | null> => {
    try {
      const rfq = await RFQModel.findById(id);
      if (!rfq) {
        return null;
      }
      return rfq as RFQDocument & { _id: mongoose.Types.ObjectId };
    } catch (error) {
      return null;
    }
  };

  update = async (
    id: string,
    data: any
  ): Promise<RFQDocument & { _id: Types.ObjectId }> => {
    try {
      const rfq = await RFQModel.findByIdAndUpdate(id, data, { new: true });
      if (!rfq) {
        throw new AppError(404, "RFQ not found");
      }
      return rfq.toObject();
    } catch (error) {
      throw new AppError(500, "Failed to update RFQ");
    }
  };

  delete = async (id: string): Promise<void> => {
    try {
      const rfq = await RFQModel.findByIdAndDelete(id);
      if (!rfq) {
        throw new AppError(404, "RFQ not found");
      }
    } catch (error) {
      throw new AppError(500, "Failed to delete RFQ");
    }
  };

  getAnalysis = async (id: string): Promise<RFQAnalysis> => {
    try {
      const rfq = await this.findById(id);
      if (!rfq) {
        throw new AppError(404, "RFQ not found");
      }
      return createAnalysisPayload(rfq);
    } catch (error) {
      console.error("Error fetching RFQ analysis:", error);
      throw new AppError(500, "Failed to fetch RFQ analysis: " + error);
    }
  };

  async generateAndSendExcel(
    rfqId: string,
    supplierEmail: string,
    supplierName: string,
    supplierId: string
  ): Promise<void> {
    try {
      // Find the RFQ
      const rfq = await this.findById(rfqId);
      if (!rfq) {
        throw new Error(`RFQ with ID ${rfqId} not found`);
      }

      // Generate Excel file
      let templateStructure = null;
      if (rfq.template && rfq.template.processedStructure) {
        templateStructure = rfq.template.processedStructure;
      }

      // Find the supplier in the RFQ to get the ID
      const supplier = rfq.suppliers?.find((s: any) => s.id === supplierId);

      // Generate Excel file with supplier ID if available
      const excelFilePath = await this.excelService.generateRFQExcel(
        rfq,
        supplierId,
        templateStructure
      );

      // Send email with attachment
      await sendInvitationEmail(supplierEmail, {
        rfqId: rfq._id,
        rfqTitle: rfq.title,
        supplierName: supplierName,
        excelFilePath: excelFilePath,
      });

      // If we found a supplier, update their status
      if (supplier) {
        // Update the supplier status to 'invited'
        const updatedSuppliers = rfq.suppliers?.map((s: any) => {
          if (s.id.toString() === supplier.id.toString()) {
            return { ...s, status: "invited" };
          }
          return s;
        });

        await this.update(rfqId, { suppliers: updatedSuppliers });
      }

      // Clean up the temporary file
      fs.unlink(excelFilePath, (err) => {
        if (err) {
          console.error("Error deleting temporary Excel file:", err);
        }
      });
    } catch (error) {
      console.error("Error generating and sending Excel:", error);
      throw error;
    }
  }

  /**
   * Generate Excel file for an RFQ
   */
  async generateRFQExcel(
    rfq: RFQDocument,
    templateStructure?: any
  ): Promise<string> {
    return this.excelService.generateRFQExcel(rfq, templateStructure);
  }

  /**
   * Process supplier Excel file and store response
   */
  async processSupplierExcel(
    rfqId: string,
    supplierId: string,
    fileBuffer: Buffer
  ): Promise<any> {
    try {
      // Get the RFQ document
      const rfq = await RFQModel.findById(rfqId);
      if (!rfq) {
        throw new Error(`RFQ with ID ${rfqId} not found`);
      }

      // Extract data from the Excel file buffer
      const extractedData = await this.excelService.extractDataFromExcelBuffer(
        fileBuffer,
        rfq,
        supplierId
      );

      // Find the latest version number for this supplier and RFQ
      // const latestQuoteRequest = await SupplierQuoteRequestModel.findOne(
      //   { rfqId, supplierId },
      //   {},
      //   { sort: { version: -1 } }
      // );

      // const newVersion = latestQuoteRequest ? latestQuoteRequest.version + 1 : 1;

      // // Create a new quote request document with base fields
      // const quoteRequest = new SupplierQuoteRequestModel({
      //   rfqId,
      //   supplierId,
      //   version: newVersion,
      //   responseData: extractedData,
      //   submittedAt: new Date(),
      //   status: 'submitted'
      // });

      // // Add each section directly to the root
      // for (const [sectionId, sectionData] of Object.entries(extractedData.sections)) {
      //   quoteRequest.set(sectionId, sectionData);
      // }

      // // Save the document
      // await quoteRequest.save();

      // // Update the supplier in the RFQ with the latest quote request ID
      // await RFQModel.updateOne(
      //   {
      //     _id: rfqId,
      //     'suppliers.id': supplierId
      //   },
      //   {
      //     $set: {
      //       'suppliers.$.latestSupplierQuoteRequestId': quoteRequest._id,
      //       'suppliers.$.responseSubmittedAt': new Date(),
      //       'suppliers.$.status': 'responded'
      //     }
      //   }
      // );

      return extractedData;
    } catch (error) {
      console.error("Error processing supplier Excel:", error);
      throw error;
    }
  }

  /**
   * Get all quote request versions for a supplier
   */
  async getSupplierQuoteHistory(
    rfqId: string,
    supplierId: string
  ): Promise<SupplierQuoteRequestDocument[]> {
    try {
      // Find all quote requests for this supplier and RFQ, sorted by version
      const quoteRequests = await SupplierQuoteRequestModel.find(
        { rfqId, supplierId },
        {},
        { sort: { version: 1 } }
      );

      return quoteRequests;
    } catch (error) {
      console.error("Error getting supplier quote history:", error);
      throw error;
    }
  }

  /**
   * Get a specific version of a supplier's quote request
   */
  async getSupplierQuoteVersion(
    rfqId: string,
    supplierId: string,
    version: number
  ): Promise<SupplierQuoteRequestDocument | null> {
    try {
      // Find the specific version
      const quoteRequest = await SupplierQuoteRequestModel.findOne({
        rfqId,
        supplierId,
        version,
      });

      return quoteRequest;
    } catch (error) {
      console.error("Error getting supplier quote version:", error);
      throw error;
    }
  }

  getRFQSuppliers = async (id: string): Promise<Supplier[]> => {
    try {
      const rfq = await RFQModel.findById(id);
      if (!rfq) {
        throw new AppError(404, "RFQ not found");
      }
      return rfq.suppliers || [];
    } catch (error) {
      throw new AppError(500, "Failed to fetch RFQ suppliers");
    }
  };

  /**
   * Add a supplier to an RFQ
   */
  async addSupplierToRFQ(
    rfqId: string,
    supplierData: Supplier
  ): Promise<Supplier[] | null> {
    try {
      const rfq = await RFQModel.findById(rfqId);

      if (!rfq) {
        throw new Error(`RFQ with ID ${rfqId} not found`);
      }

      // Initialize suppliers array if it doesn't exist
      if (!rfq.suppliers) {
        rfq.suppliers = [];
      }

      // Check if supplier already exists
      const supplierExists = rfq.suppliers.some(
        (supplier: Supplier) => supplier.id === supplierData.id
      );

      if (supplierExists) {
        throw new Error(
          `Supplier with ID ${supplierData.id} already exists in this RFQ`
        );
      }

      // Add supplier
      rfq.suppliers.push({
        ...supplierData,
        status: "invited", // Use a specific valid status from the union type
      });

      await rfq.save();

      return rfq.suppliers || null; // Return null if suppliers is undefined
    } catch (error) {
      console.error("Error adding supplier to RFQ:", error);
      throw error;
    }
  }

  /**
   * Alias for addSupplierToRFQ for backward compatibility
   */
  async addSupplier(
    rfqId: string,
    supplierData: Supplier
  ): Promise<Supplier[] | null> {
    return this.addSupplierToRFQ(rfqId, supplierData);
  }

  sendRFQToSuppliers = async (id: string): Promise<void> => {
    try {
      const rfq = await RFQModel.findById(id);
      if (!rfq) {
        throw new AppError(404, "RFQ not found");
      }

      if (!rfq.suppliers || rfq.suppliers.length === 0) {
        throw new AppError(400, "No suppliers added to this RFQ");
      }

      await this.sendSupplierEmails(rfq.toObject());

      if (rfq.generalDetails.status === "draft") {
        rfq.generalDetails.status = "pending";
        await rfq.save();
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(500, "Failed to send RFQ to suppliers");
    }
  };

  /**
   * Update supplier status in an RFQ
   */
  async updateSupplierStatus(
    rfqId: string,
    supplierId: string,
    status: string
  ): Promise<{ success: boolean; supplier?: any; message?: string }> {
    try {
      const rfq = await RFQModel.findById(rfqId);

      if (!rfq) {
        return { success: false, message: "RFQ not found" };
      }

      // Check if suppliers array exists
      if (!rfq.suppliers || !Array.isArray(rfq.suppliers)) {
        return { success: false, message: "Suppliers not found for this RFQ" };
      }

      const supplierIndex = rfq.suppliers.findIndex(
        (s) => s.id.toString() === supplierId
      );

      if (supplierIndex === -1) {
        return { success: false, message: "Supplier not found in this RFQ" };
      }

      // Validate the status is one of the allowed values
      const validStatuses = [
        "invited",
        "pending",
        "responded",
        "selected",
        "rejected",
      ];
      if (!validStatuses.includes(status)) {
        return {
          success: false,
          message: `Invalid status: ${status}. Must be one of: ${validStatuses.join(
            ", "
          )}`,
        };
      }

      // Update the supplier status with type assertion
      rfq.suppliers[supplierIndex].status = status as
        | "invited"
        | "pending"
        | "responded"
        | "selected"
        | "rejected";

      // If status is 'responded', set the responseSubmittedAt date
      if (status === "responded") {
        rfq.suppliers[supplierIndex].responseSubmittedAt = new Date();
      }

      await rfq.save();

      return {
        success: true,
        supplier: rfq.suppliers[supplierIndex],
      };
    } catch (error) {
      console.error("Error updating supplier status:", error);
      return { success: false, message: "Failed to update supplier status" };
    }
  }

  /**
   * Get Excel file for a supplier for a specific RFQ
   */
  async getSupplierExcelFile(
    rfqId: string,
    supplierId: string
  ): Promise<string> {
    try {
      // Get the RFQ document
      const rfq = await RFQModel.findById(rfqId);
      if (!rfq) {
        throw new Error(`RFQ with ID ${rfqId} not found`);
      }

      // Check if the supplier exists in the RFQ
      if (!rfq.suppliers || !Array.isArray(rfq.suppliers)) {
        throw new Error(`No suppliers found for RFQ ${rfqId}`);
      }

      const supplier = rfq.suppliers.find(
        (s) => s.id.toString() === supplierId
      );
      if (!supplier) {
        throw new Error(
          `Supplier with ID ${supplierId} not found in RFQ ${rfqId}`
        );
      }

      // Get the Excel file from the Excel service
      return this.excelService.getSupplierExcelFile(rfqId, supplierId);
    } catch (error) {
      console.error("Error getting supplier Excel file:", error);
      throw error;
    }
  }

  /**
   * Get the latest quote request for a supplier
   */
  async getLatestSupplierQuote(
    rfqId: string,
    supplierId: string
  ): Promise<SupplierQuoteRequestDocument | null> {
    try {
      // Find the latest quote request for this supplier and RFQ
      const latestQuoteRequest = await SupplierQuoteRequestModel.findOne(
        { rfqId, supplierId },
        {},
        { sort: { version: -1 } }
      );

      return latestQuoteRequest;
    } catch (error) {
      console.error("Error getting latest supplier quote:", error);
      throw error;
    }
  }

  /**
   * Store supplier response data (wrapper for backward compatibility)
   */
  async storeSupplierResponse(
    rfqId: string,
    supplierId: string,
    responseData: any
  ): Promise<void> {
    try {
      // Find the latest version number for this supplier and RFQ
      const latestQuoteRequest = await SupplierQuoteRequestModel.findOne(
        { rfqId, supplierId },
        {},
        { sort: { version: -1 } }
      );

      const newVersion = latestQuoteRequest
        ? latestQuoteRequest.version + 1
        : 1;

      const sections: Record<string, any> = {};
      for (const section of responseData.sections) {
        sections[section.id] = section;
        if (section.subsections) {
          for (const subsection of section.subsections) {
            const tempSubsection = {
              ...subsection,
              parentAccessionNumber: section.accessionNumber,
              parentSectionId: section.id,
            };
            sections[subsection.id] = tempSubsection;
          }
        }
      }
      // Create a new quote request document with base fields
      const quoteRequest = new SupplierQuoteRequestModel({
        rfqId,
        supplierId,
        version: newVersion,
        responseData: responseData,
        submittedAt: new Date(),
        status: "submitted",
        ...sections,
      });

      // Save the document
      await quoteRequest.save();

      // TODO: Temp: Uncomment this when we have to populate evaluation response from Ultron. Later change to create sqr function.
      const latestQuotes = await this.getLatestSupplierQuotes(rfqId);
      const lowestQuotes = getLowestQuotedValueForEachItem(latestQuotes);

      const supplierQuote = createSupplierQuoteForAnalysis(quoteRequest);
      const {
        supplierQuoteRequestId,
        commercialEvaluationGrades,
        questionnaireEvaluationGrades,
      } = await this.createEvaluationResponsePayload(
        supplierQuote,
        lowestQuotes
      );
      await this.updateSupplierQuoteRequestWithEvaluationResponse({
        supplierQuoteRequestId,
        commercialEvaluationGrades,
        questionnaireEvaluationGrades,
      });

      // Update the supplier in the RFQ with the latest quote request ID
      await RFQModel.updateOne(
        {
          _id: rfqId,
          "suppliers.id": supplierId,
        },
        {
          $set: {
            "suppliers.$.latestSupplierQuoteRequestId": quoteRequest._id,
            "suppliers.$.responseSubmittedAt": new Date(),
            "suppliers.$.status": "responded",
          },
        }
      );
    } catch (error) {
      console.error("Error storing supplier response:", error);
      throw error;
    }
  }

  /**
   * Get latest version of all supplier quote requests for an RFQ
   * @param rfqId The RFQ ID
   * @returns Array of latest supplier quote requests
   */
  async getLatestSupplierQuotes(
    rfqId: string
  ): Promise<SupplierQuoteRequestDocument[]> {
    try {
      // First, get all unique supplierIds for this RFQ
      const supplierIds = await SupplierQuoteRequestModel.distinct(
        "supplierId",
        { rfqId }
      );

      // For each supplierId, get the latest version
      const latestQuotes: SupplierQuoteRequestDocument[] = [];

      for (const supplierId of supplierIds) {
        const latestQuote = await SupplierQuoteRequestModel.findOne(
          { rfqId, supplierId },
          {},
          { sort: { version: -1 } }
        );

        if (latestQuote) {
          latestQuotes.push(latestQuote);
        }
      }

      return latestQuotes;
    } catch (error) {
      console.error("Error getting latest supplier quotes:", error);
      throw error;
    }
  }

  async getSupplierQuotesForAnalysis(rfqId: string): Promise<{
    sqrs: SupplierQuoteAnalysis[];
    lowestQuotes: any;
  }> {
    try {
      // First, get all unique supplierIds for this RFQ
      const latestQuotes = await this.getLatestSupplierQuotes(rfqId);
      const supplierQuotesForAnalysis =
        createSupplierQuotesForAnalysis(latestQuotes);
      const lowestQuotes = getLowestQuotedValueForEachItem(latestQuotes);
      // TODO: Temp: Uncomment this when we have to populate evaluation response from Ultron. Later change to create sqr function.
      // await this.updateSupplierQuoteRequestsWithEvaluationResponse(
      //   supplierQuotesForAnalysis,
      //   lowestQuotes
      // );

      return {
        sqrs: supplierQuotesForAnalysis,
        lowestQuotes,
      };
    } catch (error) {
      console.error("Error getting latest supplier quotes:", error);
      throw error;
    }
  }

  async createEvaluationResponsePayload(
    supplierQuote: SupplierQuoteAnalysis,
    lowestQuotes: any
  ) {
    const commercialTerms: any[] = [];
    supplierQuote.commercialTerms.forEach((commercialTerm) => {
      commercialTerms.push({
        id: commercialTerm.id,
        name: commercialTerm.term,
        supplierFinalQuote: commercialTerm.response,
      });
      const lowestQuote = lowestQuotes.commercialTerms.find(
        (q: any) => q.id === commercialTerm.id
      );
      if (lowestQuote) {
        commercialTerms.find(
          (ct: any) => ct.id === commercialTerm.id
        ).baseLine = lowestQuote.baseLine;
      }
    });
    const questionnaireEvaluationMap: Record<string, any> = {};
    for (const questionnaire of supplierQuote.questionnaires) {
      const questionnairePayload = {
        sourceLanguage: "English",
        enrichedRequest: {},
        questionnaireResponse: questionnaire.questions.map((question) => ({
          id: question.id,
          question: question.question,
          response: question.response,
        })),
      };
      const questionnaireEvaluationResponse = await this.evaluateQuestionnaire(
        questionnairePayload
      );
      questionnaireEvaluationMap[questionnaire.id] =
        questionnaireEvaluationResponse;
    }
    const commercialTermsEvaluationResponse =
      await this.evaluateCommercialTerms(commercialTerms);
    const evaluationResponsePayload = {
      supplierQuoteRequestId: supplierQuote.id,
      commercialEvaluationGrades:
        commercialTermsEvaluationResponse.responseGrade,
      questionnaireEvaluationGrades: Object.entries(
        questionnaireEvaluationMap
      ).reduce((acc: any, [key, value]) => {
        acc[key] = value.responseGrade;
        return acc;
      }, {}),
    };
    return evaluationResponsePayload;
  }

  // async updateSupplierQuoteRequestWithEvaluationResponse(
  //   sqrId: string,
  //   evaluationResponse: any
  // ) {
  //   const commercialTerms: any[] = [];
  //     quote.commercialTerms.forEach((commercialTerm) => {
  //       commercialTerms.push({
  //         id: commercialTerm.id,
  //         name: commercialTerm.term,
  //         supplierFinalQuote: commercialTerm.response,
  //       });
  //       const lowestQuote = lowestQuotes.commercialTerms.find(
  //         (q: any) => q.id === commercialTerm.id
  //       );
  //       if (lowestQuote) {
  //         commercialTerms.find(
  //           (ct: any) => ct.id === commercialTerm.id
  //         ).baseLine = lowestQuote.baseLine;
  //       }
  //     });
  //     const questionnaireEvaluationMap: Record<string, any> = {};
  //     for (const questionnaire of quote.questionnaires) {
  //       const questionnairePayload = {
  //         sourceLanguage: "English",
  //         enrichedRequest: {},
  //         questionnaireResponse: questionnaire.questions.map((question) => ({
  //           id: question.id,
  //           question: question.question,
  //           response: question.response,
  //         })),
  //       };
  //       const questionnaireEvaluationResponse =
  //         await this.evaluateQuestionnaire(questionnairePayload);
  //       questionnaireEvaluationMap[questionnaire.id] =
  //         questionnaireEvaluationResponse;
  //     }
  //     const commercialTermsEvaluationResponse =
  //       await this.evaluateCommercialTerms(commercialTerms);
  //     await this.updateSupplierQuoteRequestWithEvaluationResponse(
  //       quote.id,
  //       commercialTermsEvaluationResponse.responseGrade,
  //       Object.entries(questionnaireEvaluationMap).reduce(
  //         (acc: any, [key, value]) => {
  //           acc[key] = value.responseGrade;
  //           return acc;
  //         },
  //         {}
  //       )
  //     );
  // }

  // async updateSupplierQuoteRequestsWithEvaluationResponse(
  //   supplierQuotesForAnalysis: SupplierQuoteAnalysis[],
  //   lowestQuotes: any
  // ) {
  //   for (const quote of supplierQuotesForAnalysis) {
  //     const commercialTerms: any[] = [];
  //     quote.commercialTerms.forEach((commercialTerm) => {
  //       commercialTerms.push({
  //         id: commercialTerm.id,
  //         name: commercialTerm.term,
  //         supplierFinalQuote: commercialTerm.response,
  //       });
  //       const lowestQuote = lowestQuotes.commercialTerms.find(
  //         (q: any) => q.id === commercialTerm.id
  //       );
  //       if (lowestQuote) {
  //         commercialTerms.find(
  //           (ct: any) => ct.id === commercialTerm.id
  //         ).baseLine = lowestQuote.baseLine;
  //       }
  //     });
  //     const questionnaireEvaluationMap: Record<string, any> = {};
  //     for (const questionnaire of quote.questionnaires) {
  //       const questionnairePayload = {
  //         sourceLanguage: "English",
  //         enrichedRequest: {},
  //         questionnaireResponse: questionnaire.questions.map((question) => ({
  //           id: question.id,
  //           question: question.question,
  //           response: question.response,
  //         })),
  //       };
  //       const questionnaireEvaluationResponse =
  //         await this.evaluateQuestionnaire(questionnairePayload);
  //       questionnaireEvaluationMap[questionnaire.id] =
  //         questionnaireEvaluationResponse;
  //     }
  //     const commercialTermsEvaluationResponse =
  //       await this.evaluateCommercialTerms(commercialTerms);
  //     await this.updateSupplierQuoteRequestWithEvaluationResponse(
  //       quote.id,
  //       commercialTermsEvaluationResponse.responseGrade,
  //       Object.entries(questionnaireEvaluationMap).reduce(
  //         (acc: any, [key, value]) => {
  //           acc[key] = value.responseGrade;
  //           return acc;
  //         },
  //         {}
  //       )
  //     );
  //   }
  // }

  /**
   * Get latest version of supplier quote request for a specific supplier in an RFQ
   * @param rfqId The RFQ ID
   * @param supplierId The Supplier ID
   * @returns Latest supplier quote request or null if not found
   */
  async getLatestSupplierQuoteForSupplier(
    rfqId: string,
    supplierId: string
  ): Promise<SupplierQuoteRequestDocument | null> {
    try {
      // Find the latest quote request for this supplier and RFQ
      const latestQuote = await SupplierQuoteRequestModel.findOne(
        { rfqId, supplierId },
        {},
        { sort: { version: -1 } }
      );

      return latestQuote;
    } catch (error) {
      console.error("Error getting latest supplier quote for supplier:", error);
      throw error;
    }
  }

  /**
   * Negotiate an RFQ
   */

  async negotiateRFQ(
    rfqId: string,
    {
      negotiationResponse,
      supplierNegotiationResponses,
      negotiationType,
      numberOfRounds,
      negotiationStyle,
      commercialTermsOrder,
    }: {
      negotiationResponse: NegotiationResponse;
      supplierNegotiationResponses: Array<NegotiationResponse>;
      negotiationType: string;
      numberOfRounds: number;
      negotiationStyle: string;
      commercialTermsOrder: string[];
    }
  ): Promise<RFQDocument> {
    try {
      // Find the RFQ document
      const rfq = await RFQModel.findById(rfqId);

      if (!rfq) {
        throw new Error(`RFQ with ID ${rfqId} not found`);
      }

      // Create negotiation record in the RFQ
      rfq.updatedAt = new Date();
      rfq.negotiationType = negotiationType;
      rfq.numberOfRounds = numberOfRounds;
      rfq.negotiationStyle = negotiationStyle;

      if (rfq.commercialTermsTable) {
        rfq.commercialTermsTable.tables[0].data = commercialTermsOrder.map(
          (termId) =>
            rfq.commercialTermsTable.tables[0].data.find(
              (term: any) => term.id === termId
            )
        );
      }

      if (rfq.commercialTable) {
        negotiationResponse.products.forEach((product) => {
          const row = rfq.commercialTable.tables[0].data.find(
            (row: any) => row.id === product.productId
          );
          if (row) {
            row.target = product.negotiation;
          }
        });
      }
      if (rfq.commercialTermsTable) {
        negotiationResponse.commercialTerms.forEach((commercialTerm) => {
          const row = rfq.commercialTermsTable.tables[0].data.find(
            (row: any) => row.id === commercialTerm.key
          );
          if (row) {
            row.target = commercialTerm.negotiation;
          }
        });
      }
      if (rfq.questionnaire) {
        negotiationResponse.questionnaires.forEach((questionnaire) => {
          questionnaire.questions.forEach((question) => {
            const section = rfq.questionnaire.subsections.find(
              (section: any) => section.id === questionnaire.key
            );

            if (section?.tables?.[0]?.data) {
              const row = section.tables[0].data.find(
                (row: any) => row.id === question.key
              );
              if (row) {
                row.target = question.negotiation;
              }
            }
          });
        });
      }

      // Process supplier negotiation responses if provided
      // if (
      //   supplierNegotiationResponses &&
      //   supplierNegotiationResponses.length > 0
      // ) {
      //   // Update supplier statuses to "negotiating"
      //   if (rfq.suppliers && rfq.suppliers.length > 0) {
      //     for (const supplierResponse of supplierNegotiationResponses) {
      //       if (supplierResponse.supplierId) {
      //         const supplierIndex = rfq.suppliers.findIndex(
      //           (s) =>
      //             s.id.toString() === supplierResponse.supplierId.toString()
      //         );

      //         if (supplierIndex !== -1) {
      //           rfq.suppliers[supplierIndex].status = "negotiating";
      //           // You might want to store supplier responses here as well
      //         }
      //       }
      //     }
      //   }
      // }

      // Use markModified to ensure Mongoose detects changes to nested objects
      if (rfq.commercialTable) rfq.markModified("commercialTable");
      if (rfq.commercialTermsTable) rfq.markModified("commercialTermsTable");
      if (rfq.questionnaire) rfq.markModified("questionnaire");
      if (rfq.suppliers) rfq.markModified("suppliers");

      await rfq.save();

      return rfq;
    } catch (error) {
      console.error("Error negotiating RFQ:", error);
      throw error;
    }
  }

  async evaluateCommercialTerms(commercialTerms: any): Promise<any> {
    try {
      const negotiationSummary: NegotiationSummary = {
        commercialTermsOfferFromSuppliers: {},
      };

      const negotiationSummaryKeyMap: Record<string, string> = {};

      commercialTerms.forEach((term: any, index: number) => {
        const key = `term${index + 1}`;
        negotiationSummary.commercialTermsOfferFromSuppliers[key] = {
          name: term.name,
          baseline: term.baseLine,
          supplierFinalQuote: term.supplierFinalQuote,
        };
        negotiationSummaryKeyMap[key] = term.id;
      });

      const response = await getFromUltron(
        "general/evaluate-commercial-term-response",
        negotiationSummary
      );

      const responseData = {
        ...response.data,
        responseGrade: Object.entries(response.data.responseGrade).reduce(
          (acc: any, [key, { grade, name, reason }]: any) => {
            // Ensure grade is converted to a number
            // Use parseFloat instead of Number to better handle decimal values
            acc[negotiationSummaryKeyMap[key]] = {
              grade: parseFloat(grade) || 0, // Fallback to 0 if conversion fails
              name,
              reason,
            };
            return acc;
          },
          {}
        ),
      };

      return responseData;
    } catch (error) {
      console.error("Error evaluating commercial terms:", error);
      throw error;
    }
  }

  async evaluateQuestionnaire(questionnaire: any): Promise<any> {
    try {
      const questionnairePayload: EvaluatedQuestionnaireData = {
        sourceLanguage: questionnaire.sourceLanguage,
        enrichedRequest: questionnaire.enrichedRequest,
        questionnaireResponse: questionnaire.questionnaireResponse,
      };

      const evaluatedQuestionnaireData = await getFromUltron(
        "general/evaluate-questionnaire-response",
        questionnairePayload
      );
      const responseData = {
        ...evaluatedQuestionnaireData.data,
        responseGrade: Object.entries(
          evaluatedQuestionnaireData.data.responseGrade
        ).reduce((acc: any, [key, { id, grade, reason }]: any) => {
          acc[id] = {
            id,
            grade: parseFloat(grade) || 0,
            reason,
          };
          return acc;
        }, {}),
      };
      return responseData;
    } catch (error) {
      console.error("Error evaluating questionnaire:", error);
      throw error;
    }
  }

  async updateSupplierQuoteRequestWithEvaluationResponse({
    supplierQuoteRequestId,
    commercialEvaluationGrades,
    questionnaireEvaluationGrades,
  }: {
    supplierQuoteRequestId: string;
    commercialEvaluationGrades: Record<string, any>;
    questionnaireEvaluationGrades: Record<string, any>;
  }) {
    try {
      const sqr = await SupplierQuoteRequestModel.findById(
        supplierQuoteRequestId
      );
      if (!sqr) {
        throw new Error(
          `Supplier quote request with ID ${supplierQuoteRequestId} not found`
        );
      }

      sqr.evaluationResponse = {
        ...sqr.evaluationResponse,
        commercialTerms: commercialEvaluationGrades,
        questionnaires: questionnaireEvaluationGrades,
      };
      sqr.markModified("evaluationResponse");
      await sqr.save();
    } catch (error) {
      console.error(
        "Error updating supplier quote request with evaluation response:",
        error
      );
      throw error;
    }
  }

  async awardRFQ(rfqId: string, awardData: any): Promise<RFQDocument> {
    try {
      const rfq = await RFQModel.findById(rfqId);
      if (!rfq) {
        throw new Error(`RFQ with ID ${rfqId} not found`);
      }
      const updatedSqrs = [];
      for (const award of awardData) {
        const sqr = await SupplierQuoteRequestModel.findById(
          award.supplierQuoteRequestId
        );
        if (!sqr) {
          throw new Error(
            `Supplier quote request with ID ${award.supplierQuoteRequestId} not found`
          );
        }
        for (const item of award.items) {
          const sqrItem = sqr.commercialTable.tables[0].data.find(
            (i: any) => i.id === item.productId
          );
          sqrItem.allocatedQuantity = item.quantity;
        }
        if (sqr.commercialTable) sqr.markModified("commercialTable");
        await sqr.save();
        updatedSqrs.push(sqr);
      }
      return rfq;
    } catch (error) {
      console.error("Error awarding RFQ:", error);
      throw error;
    }
  }
}
