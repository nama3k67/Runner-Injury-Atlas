import {
  type CreateFeedback,
  createFeedbackSchema,
  type Feedback,
  feedbackSchema,
  slugSchema,
} from '@atlas/contracts';
import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { AdminGuard } from '../common/admin.guard';
import { ZodPipe } from '../common/zod-body.pipe';
import { FeedbackService } from './feedback.service';

const listQuerySchema = z.object({
  injurySlug: slugSchema.optional(),
  status: feedbackSchema.shape.status.optional(),
});
type ListQuery = z.infer<typeof listQuerySchema>;

@Controller('feedback')
export class FeedbackController {
  constructor(@Inject(FeedbackService) private readonly service: FeedbackService) {}

  /** Public and anonymous, so it is rate limited harder than the rest of the API. */
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post()
  create(@Body(new ZodPipe(createFeedbackSchema)) body: CreateFeedback): Promise<Feedback> {
    return this.service.create(body);
  }

  @UseGuards(AdminGuard)
  @Get()
  list(@Query(new ZodPipe(listQuerySchema)) query: ListQuery): Promise<Feedback[]> {
    return this.service.list(query);
  }

  @UseGuards(AdminGuard)
  @Patch(':id/resolve')
  resolve(@Param('id', new ParseUUIDPipe()) id: string): Promise<Feedback> {
    return this.service.resolve(id);
  }
}
