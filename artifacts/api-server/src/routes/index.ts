import { Router, type IRouter } from "express";
import healthRouter from "./health";
import cryptoRouter from "./crypto";
import stocksRouter from "./stocks";
import fundingRouter from "./funding";

const router: IRouter = Router();

router.use(healthRouter);
router.use(cryptoRouter);
router.use(stocksRouter);
router.use(fundingRouter);

export default router;
