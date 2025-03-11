import express from "express";
import { RFQController } from "../controllers/rfq.controller";
import { validateRFQ } from "../middleware/validation";

const router = express.Router();
const rfqController = new RFQController();

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

export default router;
