import express from "express";
import { RFQController } from "../controllers/rfq.controller";
import { validateRFQ } from "../middleware/validation";
import multer from "multer";

const router = express.Router();
const rfqController = new RFQController();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

router.post("/", validateRFQ, rfqController.create);
router.get("/", rfqController.getAll);
router.get("/:id", rfqController.getById);
router.get("/:id/analysis", rfqController.getAnalysis);
router.put("/:id", validateRFQ, rfqController.update);
router.delete("/:id", rfqController.delete);

// New supplier-related routes
router.get("/:id/suppliers", rfqController.getRFQSuppliers);
router.post("/:id/suppliers", rfqController.addSupplierToRFQ);
router.put("/:id/suppliers/:supplierId", rfqController.updateSupplierStatus);
router.delete(
  "/:id/suppliers/:supplierId",
  rfqController.removeSupplierFromRFQ
);

// Add this route to the existing routes
router.post("/:id/send", rfqController.sendRFQToSuppliers);

// Add new route for refreshing RFQ data with Gemini
router.post("/refresh-gemini", rfqController.refreshRFQWithGemini);

// Add new route for RFX master chat streaming with Gemini
router.post("/chat-gemini", rfqController.chatWithGemini);

// Add new route for executing commands on an RFX
router.post("/executed-commands", rfqController.executedRFXCommands);

// Add new route for processing document through multiple Gemini endpoints
router.post("/process-document", rfqController.processDocumentWithGemini);

// Add new route for generating email with Gemini
router.post("/generate-email", rfqController.generateEmailWithGemini);

// Add new route for generating and sending RFQ Excel
router.post("/generate-excel", rfqController.generateAndSendRFQExcel);

// Add route for generating RFQ Excel for download
router.get("/:id/excel", rfqController.generateRFQExcel);

// Add route for downloading supplier Excel
router.get(
  "/:id/suppliers/:supplierId/excel",
  rfqController.downloadSupplierExcel
);

// For sending to suppliers in an existing RFQ
router.post("/:id/send-excel", rfqController.sendExcelForRFQ);

// For sending to arbitrary email addresses with an RFQ object

// Add a new route for Excel uploads
router.post(
  "/:rfqId/supplier/:supplierId/upload-excel",
  upload.single("file"),
  rfqController.processSupplierExcel
);

// Add this route to your existing routes
router.get(
  "/supplier/:supplierId/download-excel/:rfqId",
  rfqController.downloadSupplierExcel
);

// Add these routes to your existing routes
router.get(
  "/:rfqId/supplier/:supplierId/quotes",
  rfqController.getSupplierQuoteHistory
);
router.get(
  "/:rfqId/supplier/:supplierId/quotes/:version",
  rfqController.getSupplierQuoteVersion
);

// Add this route to your existing routes
router.get("/:rfqId/supplier-quotes", rfqController.getLatestSupplierQuotes);

// Add this route to your existing routes
router.get(
  "/:rfqId/supplier/:supplierId/latest-quote",
  rfqController.getLatestSupplierQuoteForSupplier
);

router.get(
  "/:rfqId/supplier-quotes-for-analysis",
  rfqController.getSupplierQuotesForAnalysis
);

export default router;
