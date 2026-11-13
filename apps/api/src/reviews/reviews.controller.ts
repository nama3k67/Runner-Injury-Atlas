import {
  type DecideReview,
  decideReviewSchema,
  type RequestReview,
  type Review,
  type ReviewBadge,
  requestReviewSchema,
  slugSchema,
} from '@atlas/contracts';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { AdminGuard } from '../common/admin.guard';
import { ZodPipe } from '../common/zod-body.pipe';
import { ReviewsService } from './reviews.service';

const listQuerySchema = z.object({ injurySlug: slugSchema.optional() });

@Controller('reviews')
export class ReviewsController {
  constructor(@Inject(ReviewsService) private readonly service: ReviewsService) {}

  @Get('badge')
  badge(@Query(new ZodPipe(requestReviewSchema)) query: RequestReview): Promise<ReviewBadge> {
    return this.service.badge(query.injurySlug, query.contentHash);
  }

  @UseGuards(AdminGuard)
  @Get()
  list(
    @Query(new ZodPipe(listQuerySchema)) query: z.infer<typeof listQuerySchema>,
  ): Promise<Review[]> {
    return this.service.list(query.injurySlug);
  }

  @UseGuards(AdminGuard)
  @Post()
  request(@Body(new ZodPipe(requestReviewSchema)) body: RequestReview): Promise<Review> {
    return this.service.request(body);
  }

  @UseGuards(AdminGuard)
  @HttpCode(200)
  @Post(':id/decision')
  decide(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(decideReviewSchema)) body: DecideReview,
  ): Promise<Review> {
    return this.service.decide(id, body);
  }
}
