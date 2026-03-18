// // ─── src/address/location.controller.ts ──────────────────────
// // Public endpoints for location hierarchy (Division → City → Area)

// import { Controller, Get, Param } from '@nestjs/common';
// import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
// import { Public } from '../common/decorators/public.decorator';
// import { PrismaService } from '../prisma/prisma.service';

// @ApiTags('Locations - Hierarchical Selection')
// @Public()
// @Controller('locations')
// export class LocationController {
//   constructor(private readonly prisma: PrismaService) {}

//   // ═══════════════════════════════════════════════════════════
//   // DIVISION ENDPOINTS
//   // ═══════════════════════════════════════════════════════════

//   @Get('divisions')
//   @ApiOperation({
//     summary: '[Public] Get all divisions',
//     description: 'Returns all active divisions for location selection',
//   })
//   @ApiResponse({
//     status: 200,
//     description: 'List of divisions',
//     schema: {
//       example: {
//         success: true,
//         message: 'Divisions retrieved',
//         data: [
//           {
//             id: 'clx1234567890',
//             name: 'Dhaka',
//             slug: 'dhaka',
//             position: 0,
//           },
//         ],
//       },
//     },
//   })
//   async getDivisions() {
//     const data = await this.prisma.division.findMany({
//       where: { isActive: true, deletedAt: null },
//       select: {
//         id: true,
//         name: true,
//         slug: true,
//         position: true,
//       },
//       orderBy: { position: 'asc' },
//     });

//     return {
//       message: 'Divisions retrieved',
//       data,
//     };
//   }

//   @Get('divisions/:divisionId')
//   @ApiParam({ name: 'divisionId', description: 'Division ID' })
//   @ApiOperation({
//     summary: '[Public] Get division details',
//     description: 'Returns single division with city count',
//   })
//   @ApiResponse({
//     status: 200,
//     description: 'Division details',
//     schema: {
//       example: {
//         success: true,
//         message: 'Division retrieved',
//         data: {
//           id: 'clx1234567890',
//           name: 'Dhaka',
//           slug: 'dhaka',
//           cityCount: 15,
//         },
//       },
//     },
//   })
//   async getDivision(@Param('divisionId') divisionId: string) {
//     const division = await this.prisma.division.findFirst({
//       where: { id: divisionId, isActive: true, deletedAt: null },
//       select: {
//         id: true,
//         name: true,
//         slug: true,
//         position: true,
//         _count: {
//           select: { cities: true },
//         },
//       },
//     });

//     if (!division) {
//       return {
//         message: 'Division not found',
//         data: null,
//       };
//     }

//     return {
//       message: 'Division retrieved',
//       data: {
//         ...division,
//         cityCount: division._count.cities,
//       },
//     };
//   }

//   // ═══════════════════════════════════════════════════════════
//   // CITY ENDPOINTS
//   // ═══════════════════════════════════════════════════════════

//   @Get('divisions/:divisionId/cities')
//   @ApiParam({ name: 'divisionId', description: 'Division ID' })
//   @ApiOperation({
//     summary: '[Public] Get cities by division',
//     description: 'Returns all active cities in a division',
//   })
//   @ApiResponse({
//     status: 200,
//     description: 'List of cities',
//     schema: {
//       example: {
//         success: true,
//         message: 'Cities retrieved',
//         data: [
//           {
//             id: 'clx9876543210',
//             name: 'Dhaka',
//             slug: 'dhaka',
//             divisionId: 'clx1234567890',
//             divisionName: 'Dhaka',
//           },
//         ],
//       },
//     },
//   })
//   async getCitiesByDivision(@Param('divisionId') divisionId: string) {
//     const data = await this.prisma.city.findMany({
//       where: {
//         divisionId,
//         isActive: true,
//         deletedAt: null,
//       },
//       select: {
//         id: true,
//         name: true,
//         slug: true,
//         divisionId: true,
//         division: {
//           select: {
//             name: true,
//           },
//         },
//       },
//       orderBy: { name: 'asc' },
//     });

//     return {
//       message: 'Cities retrieved',
//       data: data.map((city) => ({
//         id: city.id,
//         name: city.name,
//         slug: city.slug,
//         divisionId: city.divisionId,
//         divisionName: city.division.name,
//       })),
//     };
//   }

//   @Get('cities/:cityId')
//   @ApiParam({ name: 'cityId', description: 'City ID' })
//   @ApiOperation({
//     summary: '[Public] Get city details',
//     description: 'Returns single city with area count',
//   })
//   @ApiResponse({
//     status: 200,
//     description: 'City details',
//   })
//   async getCity(@Param('cityId') cityId: string) {
//     const city = await this.prisma.city.findFirst({
//       where: { id: cityId, isActive: true, deletedAt: null },
//       select: {
//         id: true,
//         name: true,
//         slug: true,
//         divisionId: true,
//         division: {
//           select: {
//             id: true,
//             name: true,
//           },
//         },
//         _count: {
//           select: { areas: true },
//         },
//       },
//     });

//     if (!city) {
//       return {
//         message: 'City not found',
//         data: null,
//       };
//     }

//     return {
//       message: 'City retrieved',
//       data: {
//         ...city,
//         areaCount: city._count.areas,
//       },
//     };
//   }

//   // ═══════════════════════════════════════════════════════════
//   // AREA ENDPOINTS
//   // ═══════════════════════════════════════════════════════════

//   @Get('cities/:cityId/areas')
//   @ApiParam({ name: 'cityId', description: 'City ID' })
//   @ApiOperation({
//     summary: '[Public] Get areas by city',
//     description: 'Returns all active areas in a city with delivery zone info',
//   })
//   @ApiResponse({
//     status: 200,
//     description: 'List of areas',
//     schema: {
//       example: {
//         success: true,
//         message: 'Areas retrieved',
//         data: [
//           {
//             id: 'clx5555555555',
//             name: 'Gulshan 1',
//             slug: 'gulshan-1',
//             postalCode: '1212',
//             cityId: 'clx9876543210',
//             cityName: 'Dhaka',
//             deliveryZone: {
//               id: 'clx7777777777',
//               name: 'Dhaka North',
//               slug: 'dhaka-north',
//             },
//           },
//         ],
//       },
//     },
//   })
//   async getAreasByCity(@Param('cityId') cityId: string) {
//     const data = await this.prisma.area.findMany({
//       where: {
//         cityId,
//         isActive: true,
//         deletedAt: null,
//       },
//       select: {
//         id: true,
//         name: true,
//         slug: true,
//         postalCode: true,
//         cityId: true,
//         city: {
//           select: {
//             name: true,
//           },
//         },
//         deliveryZone: {
//           select: {
//             id: true,
//             name: true,
//             slug: true,
//             isActive: true,
//           },
//         },
//       },
//       orderBy: { name: 'asc' },
//     });

//     return {
//       message: 'Areas retrieved',
//       data: data.map((area) => ({
//         id: area.id,
//         name: area.name,
//         slug: area.slug,
//         postalCode: area.postalCode,
//         cityId: area.cityId,
//         cityName: area.city.name,
//         deliveryZone: area.deliveryZone,
//       })),
//     };
//   }

//   @Get('areas/:areaId')
//   @ApiParam({ name: 'areaId', description: 'Area ID' })
//   @ApiOperation({
//     summary: '[Public] Get area details',
//     description: 'Returns single area with full location hierarchy',
//   })
//   @ApiResponse({
//     status: 200,
//     description: 'Area details with hierarchy',
//   })
//   async getArea(@Param('areaId') areaId: string) {
//     const area = await this.prisma.area.findFirst({
//       where: { id: areaId, isActive: true, deletedAt: null },
//       select: {
//         id: true,
//         name: true,
//         slug: true,
//         postalCode: true,
//         cityId: true,
//         city: {
//           select: {
//             id: true,
//             name: true,
//             slug: true,
//             divisionId: true,
//             division: {
//               select: {
//                 id: true,
//                 name: true,
//                 slug: true,
//               },
//             },
//           },
//         },
//         deliveryZone: {
//           select: {
//             id: true,
//             name: true,
//             slug: true,
//             isActive: true,
//           },
//         },
//       },
//     });

//     if (!area) {
//       return {
//         message: 'Area not found',
//         data: null,
//       };
//     }

//     return {
//       message: 'Area retrieved',
//       data: {
//         ...area,
//         division: area.city.division,
//       },
//     };
//   }

//   // ═══════════════════════════════════════════════════════════
//   // SEARCH ENDPOINTS
//   // ═══════════════════════════════════════════════════════════

//   @Get('search/postal-code/:code')
//   @ApiParam({
//     name: 'code',
//     description: 'Postal code to search',
//     example: '1212',
//   })
//   @ApiOperation({
//     summary: '[Public] Search by postal code',
//     description: 'Find areas matching a postal code',
//   })
//   @ApiResponse({
//     status: 200,
//     description: 'Matching areas',
//   })
//   async searchByPostalCode(@Param('code') code: string) {
//     const areas = await this.prisma.area.findMany({
//       where: {
//         postalCode: code,
//         isActive: true,
//         deletedAt: null,
//       },
//       select: {
//         id: true,
//         name: true,
//         slug: true,
//         postalCode: true,
//         city: {
//           select: {
//             id: true,
//             name: true,
//             division: {
//               select: {
//                 id: true,
//                 name: true,
//               },
//             },
//           },
//         },
//         deliveryZone: {
//           select: {
//             id: true,
//             name: true,
//           },
//         },
//       },
//     });

//     return {
//       message:
//         areas.length > 0
//           ? 'Areas found'
//           : 'No areas found for this postal code',
//       data: areas.map((area) => ({
//         ...area,
//         divisionId: area.city.division.id,
//         divisionName: area.city.division.name,
//         cityId: area.city.id,
//         cityName: area.city.name,
//       })),
//     };
//   }
// }

// src/address/location.controller.ts
// Public endpoints for location hierarchy (Division → City → Area)

import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Locations - Hierarchical Selection')
@Public()
@Controller('locations')
export class LocationController {
  constructor(private readonly prisma: PrismaService) {}

  // ─── DIVISIONS ───────────────────────────────────────────────

  @Get('divisions')
  @ApiOperation({ summary: '[Public] Get all divisions' })
  async getDivisions() {
    const data = await this.prisma.division.findMany({
      where: { isActive: true, deletedAt: null },
      select: { id: true, name: true, slug: true, position: true },
      orderBy: { position: 'asc' },
    });
    return { message: 'Divisions retrieved', data };
  }

  @Get('divisions/:divisionId')
  @ApiParam({ name: 'divisionId' })
  @ApiOperation({ summary: '[Public] Get division details' })
  async getDivision(@Param('divisionId') divisionId: string) {
    const division = await this.prisma.division.findFirst({
      where: { id: divisionId, isActive: true, deletedAt: null },
      select: {
        id: true,
        name: true,
        slug: true,
        position: true,
        _count: { select: { cities: true } },
      },
    });

    if (!division) {
      return { message: 'Division not found', data: null };
    }

    return {
      message: 'Division retrieved',
      data: { ...division, cityCount: division._count.cities },
    };
  }

  // ─── CITIES ──────────────────────────────────────────────────

  @Get('divisions/:divisionId/cities')
  @ApiParam({ name: 'divisionId' })
  @ApiOperation({ summary: '[Public] Get cities by division' })
  async getCitiesByDivision(@Param('divisionId') divisionId: string) {
    const data = await this.prisma.city.findMany({
      where: { divisionId, isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        divisionId: true,
        division: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    });

    return {
      message: 'Cities retrieved',
      data: data.map((city) => ({
        id: city.id,
        name: city.name,
        slug: city.slug,
        divisionId: city.divisionId,
        divisionName: city.division.name,
      })),
    };
  }

  @Get('cities/:cityId')
  @ApiParam({ name: 'cityId' })
  @ApiOperation({ summary: '[Public] Get city details' })
  async getCity(@Param('cityId') cityId: string) {
    const city = await this.prisma.city.findFirst({
      where: { id: cityId, isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        divisionId: true,
        division: { select: { id: true, name: true } },
        _count: { select: { areas: true } },
      },
    });

    if (!city) {
      return { message: 'City not found', data: null };
    }

    return {
      message: 'City retrieved',
      data: { ...city, areaCount: city._count.areas },
    };
  }

  // ─── AREAS ───────────────────────────────────────────────────

  @Get('cities/:cityId/areas')
  @ApiParam({ name: 'cityId' })
  @ApiOperation({ summary: '[Public] Get areas by city' })
  async getAreasByCity(@Param('cityId') cityId: string) {
    const data = await this.prisma.area.findMany({
      where: { cityId, isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        postalCode: true,
        cityId: true,
        city: { select: { name: true } },
        deliveryZone: {
          select: { id: true, name: true, slug: true, isActive: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return {
      message: 'Areas retrieved',
      data: data.map((area) => ({
        id: area.id,
        name: area.name,
        slug: area.slug,
        postalCode: area.postalCode,
        cityId: area.cityId,
        cityName: area.city.name,
        deliveryZone: area.deliveryZone,
      })),
    };
  }

  @Get('areas/:areaId')
  @ApiParam({ name: 'areaId' })
  @ApiOperation({ summary: '[Public] Get area details' })
  async getArea(@Param('areaId') areaId: string) {
    const area = await this.prisma.area.findFirst({
      where: { id: areaId, isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        postalCode: true,
        cityId: true,
        city: {
          select: {
            id: true,
            name: true,
            slug: true,
            divisionId: true,
            division: { select: { id: true, name: true, slug: true } },
          },
        },
        deliveryZone: {
          select: { id: true, name: true, slug: true, isActive: true },
        },
      },
    });

    if (!area) {
      return { message: 'Area not found', data: null };
    }

    return {
      message: 'Area retrieved',
      data: {
        id: area.id,
        name: area.name,
        slug: area.slug,
        postalCode: area.postalCode,
        cityId: area.cityId,
        city: area.city,
        division: area.city.division,
        deliveryZone: area.deliveryZone,
      },
    };
  }

  // ─── SEARCH ──────────────────────────────────────────────────

  @Get('search/postal-code/:code')
  @ApiParam({ name: 'code', example: '1212' })
  @ApiOperation({ summary: '[Public] Search by postal code' })
  async searchByPostalCode(@Param('code') code: string) {
    const areas = await this.prisma.area.findMany({
      where: { postalCode: code, isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        postalCode: true,
        city: {
          select: {
            id: true,
            name: true,
            division: { select: { id: true, name: true } },
          },
        },
        deliveryZone: { select: { id: true, name: true } },
      },
    });

    return {
      message:
        areas.length > 0
          ? 'Areas found'
          : 'No areas found for this postal code',
      data: areas.map((area) => ({
        id: area.id,
        name: area.name,
        slug: area.slug,
        postalCode: area.postalCode,
        divisionId: area.city.division.id,
        divisionName: area.city.division.name,
        cityId: area.city.id,
        cityName: area.city.name,
        deliveryZone: area.deliveryZone,
      })),
    };
  }
}
