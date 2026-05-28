import { Router, type IRouter } from "express";
import healthRouter from "./health";
import songsRouter from "./songs";
import searchRouter from "./search";
import playlistsRouter from "./playlists";
import songboardRouter from "./songboard";
import queueRouter from "./queue";
import dailyRouter from "./daily";
import forumRouter from "./forum";
import usersRouter from "./users";
import statsRouter from "./stats";

const router: IRouter = Router();

router.use(healthRouter);
router.use(songsRouter);
router.use(searchRouter);
router.use(playlistsRouter);
router.use(songboardRouter);
router.use(queueRouter);
router.use(dailyRouter);
router.use(forumRouter);
router.use(usersRouter);
router.use(statsRouter);

export default router;
