import {
  completeMatchHandler,
  getMatchResultHandler
} from "../end-game/end-game.controller.js";

import {
  getMatchExperienceHandler
} from "../experience/experience.controller.js";

import { submitTurnHandler } from "../turns/turn.controller.js";
import { Router } from "express";

import {
  asyncHandler
} from "../../utils/async-handler.js";

import {
  resolveMatchActor
} from "./match-actor.middleware.js";

import {
  validateDictionaryWordsHandler
} from "../dictionary/dictionary.controller.js";

import {
  addMatchPlayerHandler,
  cancelMatchHandler,
  createMatchHandler,
  getMatchHandler,
  listMatchesHandler,
  removeMatchPlayerHandler,
  reorderMatchPlayersHandler,
  startMatchHandler,
  updateMatchHandler
} from "./match.controller.js";

export const matchRouter = Router();

matchRouter.use(
  resolveMatchActor
);

matchRouter.post(
  "/",
  asyncHandler(
    createMatchHandler
  )
);

matchRouter.get(
  "/",
  asyncHandler(
    listMatchesHandler
  )
);

matchRouter.get(
  "/:matchId/results",
  asyncHandler(
    getMatchResultHandler
  )
);

matchRouter.get(
  "/:matchId/experience",
  asyncHandler(
    getMatchExperienceHandler
  )
);

matchRouter.get(
  "/:matchId",
  asyncHandler(
    getMatchHandler
  )
);

matchRouter.patch(
  "/:matchId",
  asyncHandler(
    updateMatchHandler
  )
);

matchRouter.post(
  "/:matchId/players",
  asyncHandler(
    addMatchPlayerHandler
  )
);

matchRouter.put(
  "/:matchId/players/order",
  asyncHandler(
    reorderMatchPlayersHandler
  )
);

matchRouter.delete(
  "/:matchId/players/:playerId",
  asyncHandler(
    removeMatchPlayerHandler
  )
);

matchRouter.post(
  "/:matchId/dictionary/validate",
  asyncHandler(
    validateDictionaryWordsHandler
  )
);

matchRouter.post(
  "/:matchId/start",
  asyncHandler(
    startMatchHandler
  )
);

matchRouter.post(
  "/:matchId/complete",
  asyncHandler(
    completeMatchHandler
  )
);

matchRouter.post(
  "/:matchId/cancel",
  asyncHandler(
    cancelMatchHandler
  )
);
matchRouter.post(
  "/:matchId/turns",
  asyncHandler(
    submitTurnHandler
  )
);
