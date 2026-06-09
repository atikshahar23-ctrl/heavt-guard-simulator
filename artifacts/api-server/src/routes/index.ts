import { Router, type IRouter } from "express";
import healthRouter from "./health";
import cryptoRouter from "./crypto";
import stocksRouter from "./stocks";
import fundingRouter from "./funding";
import polymarketRouter from "./polymarket";
import userStateRouter from "./userState";
import socialRouter from "./social";

const router: IRouter = Router();

router.use(healthRouter);
router.use(cryptoRouter);
router.use(stocksRouter);
router.use(fundingRouter);
router.use(polymarketRouter);
router.use(userStateRouter);
router.use(socialRouter);

export default router;
