import { IsString, IsNumber, IsArray, IsOptional, IsBoolean, IsDateString, Min, ValidateNested, IsUrl, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';

export class DateDto {
  @IsDateString()
  start: string;

  @IsDateString()
  end: string;

  @IsOptional()
  @IsString()
  heureArrivee?: string;

  @IsOptional()
  @IsString()
  heureDepart?: string;
}

export class CreateRetreatDto {
  @IsString()
  titreCard: string;

  @IsUrl()
  imageCard: string;

  @IsString()
  altImageCard: string;

  @IsArray()
  @IsString({ each: true })
  imageModal: string[];

  @IsArray()
  @IsString({ each: true })
  altImageModal: string[];

  @IsString()
  texteModal: string;

  @IsString()
  adresseRdv: string;

  @IsString()
  boutonPdfLabel: string;

  @IsOptional()
  @ValidateIf((o) => o.pdfUrl !== undefined && o.pdfUrl !== null && o.pdfUrl !== '')
  @IsUrl({}, { message: 'pdfUrl doit être une URL valide' })
  pdfUrl?: string;

  @IsNumber()
  @Min(1)
  places: number;

  @IsNumber()
  @Min(0)
  prix: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DateDto)
  dates?: DateDto[];

  @IsOptional()
  @IsBoolean()
  bientotDisponible?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateRetreatDto {
  @IsOptional()
  @IsString()
  titreCard?: string;

  @IsOptional()
  @IsUrl()
  imageCard?: string;

  @IsOptional()
  @IsString()
  altImageCard?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imageModal?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  altImageModal?: string[];

  @IsOptional()
  @IsString()
  texteModal?: string;

  @IsOptional()
  @IsString()
  adresseRdv?: string;

  @IsOptional()
  @IsString()
  boutonPdfLabel?: string;

  @IsOptional()
  @ValidateIf((o) => o.pdfUrl !== undefined && o.pdfUrl !== null && o.pdfUrl !== '')
  @IsUrl({}, { message: 'pdfUrl doit être une URL valide' })
  pdfUrl?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  places?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  prix?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DateDto)
  dates?: DateDto[];

  @IsOptional()
  @IsBoolean()
  bientotDisponible?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
