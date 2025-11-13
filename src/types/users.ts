import { z } from 'zod';

// User roles
export const userRoles = ["Administrador", "Gerente de Proyecto", "Consultor", "Usuario Final"] as const;
export type UserRole = typeof userRoles[number];

// Access levels
export const nivelesAcceso = ["Público", "Departamental", "Jerárquico", "Ejecutivo", "Confidencial"] as const;
export type NivelAcceso = typeof nivelesAcceso[number];

// User interface
export interface User {
  id: string;
  nombreCompleto: string;
  email: string;
  rol: UserRole;
  nivelAcceso: NivelAcceso;
  activo: boolean;
  puestoId?: string;
  departamentoId?: string;
  areaId?: string;
  claimsVersion?: number;
}

// User form schema
export const userFormSchema = z.object({
  id: z.string().optional(),
  nombreCompleto: z.string().min(3, 'El nombre completo debe tener al menos 3 caracteres.').max(60, 'El nombre no puede exceder 60 caracteres.').regex(/^[a-zA-ZÀ-ÿ\u00f1\u00d1\s]+$/, 'El nombre solo puede contener letras y espacios.'),
  email: z.string().email('Ingrese un correo electrónico válido.'),
  rol: z.enum(userRoles, { errorMap: () => ({ message: "Seleccione un rol válido." }) }),
  nivelAcceso: z.enum(nivelesAcceso, { errorMap: () => ({ message: "Seleccione un nivel de acceso." }) }),
  puestoId: z.string().optional(),
  activo: z.boolean().default(true),
});

export type UserFormData = z.infer<typeof userFormSchema>;

// Exception types
export const exceptionFormSchema = z.object({
  userId: z.string({ required_error: 'Debe seleccionar un usuario.' }),
  documentType: z.enum(['politica', 'proceso'], { required_error: 'Debe seleccionar un tipo de documento.' }),
  documentId: z.string({ required_error: 'Debe seleccionar un documento.' }),
  exceptionType: z.enum(['INCLUDE', 'EXCLUDE'], { required_error: 'Debe seleccionar un tipo de excepción.' }),
  expiresAt: z.date().optional(),
  justification: z.string().min(10, 'La justificación es requerida (mínimo 10 caracteres).').max(1000, 'La justificación no puede exceder 1000 caracteres.'),
});

export type ExceptionFormData = z.infer<typeof exceptionFormSchema>;

export interface AccessException {
  id: string;
  userId: string;
  documentType: 'politica' | 'proceso';
  documentId: string;
  exceptionType: 'INCLUDE' | 'EXCLUDE';
  createdAt: string;
  expiresAt?: string;
  justification: string;
}

export interface AccessExceptionCreationData {
  userId: string;
  documentType: 'politica' | 'proceso';
  documentId: string;
  exceptionType: 'INCLUDE' | 'EXCLUDE';
  expiresAt?: Date;
  justification: string;
}
