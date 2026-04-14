/**
 * Barrel import for all mechanic types.
 * Importing this file triggers self-registration of all mechanics in the MechanicRegistry.
 */

// Force fields
import './BoostStrip';
import './SuctionZone';
import './LowGravityZone';
import './BowlContour';

// Moving obstacles
import './MovingSweeper';
import './TimedHazard';
import './TimedGate';

// Structural
import './BankWall';
import './SplitRoute';
import './RicochetBumpers';
import './ElevatedGreen';
import './MultiLevelRamp';

// Timed hazards
import './LaserGrid';
import './DisappearingPlatform';

// Directional force
import './GravityFunnel';

// Teleportation
import './PortalGate';

// Re-export registry for convenience
export { createMechanic, registerMechanic, getRegisteredTypes } from './MechanicRegistry';
