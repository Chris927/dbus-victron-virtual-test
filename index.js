const dbus = require('dbus-native-victron');
const { addVictronInterfaces, addSettings } = require('dbus-victron-virtual')
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

const validDevices = ['battery', 'temperature', 'grid', 'pvinverter', 'meteo', 'tank'];

const argv = yargs(hideBin(process.argv))
  .usage('Usage: $0 --device <device-type> --id <identifier>')
  .options({
    device: {
      alias: 'd',
      describe: 'Type of virtual device to create',
      choices: validDevices,
      demandOption: true
    },
    id: {
      alias: 'i',
      describe: 'Unique identifier for the virtual device',
      type: 'string',
      default: 'dev1'
    }
  })
  .example('$0 --device battery --id batt1', 'Create a virtual battery with ID batt1')
  .example('$0 -d temperature -i temp1', 'Create a virtual temperature sensor with ID temp1')
  .argv;

let usedBus;
const device = argv.device;
const deviceId = argv.id;

const properties = {
  battery: {
    Capacity: { type: 'd', format: (v) => v != null ? v.toFixed(0) + 'Ah' : '' },
    'Dc/0/Current': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'A' : '' },
    'Dc/0/Power': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'W' : '' },
    'Dc/0/Voltage': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'V' : '' },
    'Dc/0/Temperature': { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'C' : '' },
    Soc: { type: 'd', min: 0, max: 100, format: (v) => v != null ? v.toFixed(0) + '%' : '' }
  },
  temperature: {
    Temperature: { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'C' : '' },
    TemperatureType: {
      type: 'i',
      value: 2,
      min: 0,
      max: 2,
      format: (v) => ({
        0: 'Battery',
        1: 'Fridge',
        2: 'Generic'
      }[v] || 'unknown')
    },
    Pressure: { type: 'd', format: (v) => v != null ? v.toFixed(0) + 'hPa' : '' },
    Humidity: { type: 'd', format: (v) => v != null ? v.toFixed(1) + '%' : '' },
    BatteryVoltage: { type: 'd', value: 3.3, format: (v) => v != null ? v.toFixed(2) + 'V' : '' },
    Status: { type: 'i' }
  },
  grid: {
    'Ac/Energy/Forward': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'kWh' : '', value: 0 },
    'Ac/Energy/Reverse': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'kWh' : '', value: 0 },
    'Ac/Frequency': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'Hz' : '' },
    'Ac/N/Current': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'A' : '' },
    'Ac/Power': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'W' : '' },
    'Ac/PENVoltage': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'V' : '' },
    NrOfPhases: { type: 'd', format: (v) => v != null ? v : '', value: 1 },
    ErrorCode: { type: 'd', format: (v) => v != null ? v : '', value: 0 },
    Connected: { type: 'd', format: (v) => v != null ? v : '', value: 1 },
    Position: { type: 'd', format: (v) => v != null ? v : '', value: 0 }
  },
  pvinverter: {
    'Ac/Energy/Forward': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'kWh' : '' },
    'Ac/Power': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'W' : '' },
    'Ac/L1/Current': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'A' : '' },
    'Ac/L1/Energy/Forward': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'kWh' : '' },
    'Ac/L1/Power': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'W' : '' },
    'Ac/L1/Voltage': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'V' : '' },
    'Ac/L2/Current': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'A' : '' },
    'Ac/L2/Energy/Forward': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'kWh' : '' },
    'Ac/L2/Power': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'W' : '' },
    'Ac/L2/Voltage': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'V' : '' },
    'Ac/L3/Current': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'A' : '' },
    'Ac/L3/Energy/Forward': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'kWh' : '' },
    'Ac/L3/Power': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'W' : '' },
    'Ac/L3/Voltage': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'V' : '' },
    'Ac/MaxPower': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'W' : '' },
    'Ac/PowerLimit': { type: 'd', format: (v) => v != null ? v.toFixed(2) + 'W' : '' },
    ErrorCode: {
      type: 'i',
      value: 0,
      format: (v) => ({
        0: 'No error'
      }[v] || 'unknown')
    },
    Position: {
      type: 'i',
      format: (v) => ({
        0: 'AC input 1',
        1: 'AC output',
        2: 'AC input 2'
      }[v] || 'unknown')
    },
    StatusCode: {
      type: 'i',
      format: (v) => ({
        0: 'Startup 0',
        1: 'Startup 1',
        2: 'Startup 2',
        3: 'Startup 3',
        4: 'Startup 4',
        5: 'Startup 5',
        6: 'Startup 6',
        7: 'Running',
        8: 'Standby',
        9: 'Boot loading',
        10: 'Error'
      }[v] || 'unknown')
    }
  },
  meteo: {
    Irradiance: { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'W/m2' : '' },
    WindSpeed: { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'm/s' : '' },
    WindDirection: { type: 'd' }
  },
  tank: {
    'Alarms/High/Active': { type: 'd' },
    'Alarms/High/Delay': { type: 'd' },
    'Alarms/High/Enable': { type: 'd' },
    'Alarms/High/Restore': { type: 'd' },
    'Alarms/High/State': { type: 'd' },
    'Alarms/Low/Active': { type: 'd' },
    'Alarms/Low/Delay': { type: 'd' },
    'Alarms/Low/Enable': { type: 'd' },
    'Alarms/Low/Restore': { type: 'd' },
    'Alarms/Low/State': { type: 'd' },
    Capacity: { type: 'd' },
    FluidType: {
      type: 'i',
      format: (v) => ({
        0: 'Fuel',
        1: 'Fresh water',
        2: 'Waste water',
        3: 'Live well',
        4: 'Oil',
        5: 'Black water (sewage)',
        6: 'Gasoline',
        7: 'Diesel',
        8: 'LPG',
        9: 'LNG',
        10: 'Hydraulic oil',
        11: 'Raw water'
      }[v] || 'unknown'),
      value: 0
    },
    Level: { type: 'd' },
    RawUnit: { type: 's' },
    RawValue: { type: 'd' },
    RawValueEmpty: { type: 'd' },
    RawValueFull: { type: 'd' },
    Remaining: { type: 'd' },
    Shape: { type: 's' },
    Temperature: { type: 'd', format: (v) => v != null ? v.toFixed(1) + 'C' : '' },
    BatteryVoltage: { type: 'd', value: 3.3, format: (v) => v != null ? v.toFixed(2) + 'V' : '' },
    Status: { type: 'i' }
  }
}

function getIfaceDesc (dev) {
  if (!properties[dev]) {
    return {}
  }

  const result = {}

  // Deep copy the properties, including format functions
  for (const [key, value] of Object.entries(properties[dev])) {
    result[key] = { ...value }
    if (typeof value.format === 'function') {
      result[key].format = value.format
    }
  }

  result.DeviceInstance = { type: 'i' }
  result.CustomName = { type: 's' }
  result.Serial = { type: 's' }

  return result
}

function getIface (dev) {
  if (!properties[dev]) {
    return { emit: function () {} }
  }

  const result = { emit: function () {} }

  for (const key in properties[dev]) {
    const propertyValue = JSON.parse(JSON.stringify(properties[dev][key]))

    if (propertyValue.value !== undefined) {
      result[key] = propertyValue.value
    } else {
      switch (propertyValue.type) {
        case 's':
          result[key] = '-'
          break
        default:
          result[key] = null
      }
    }
  }

  return result
}

let address = process.env.DBUS_ADDRESS
  ? process.env.DBUS_ADDRESS.split(':')
  : null
if (address && address.length === 2) {
  address = `tcp:host=${address[0]},port=${address[1]}`
}

// Connnect to the dbus
if (address) {
  console.log(`Connecting to TCP address ${address}.`)
  usedBus = dbus.createClient({
    busAddress: address,
    authMethods: ['ANONYMOUS']
  })
} else {
  usedBus = process.env.BUS_ADDRESS
  ? dbus.sessionBus()
  : dbus.systemBus()
}

console.log('usedBus', usedBus);

const serviceName = `com.victronenergy.${device}.virtual_${deviceId}`;
const interfaceName = serviceName;
const objectPath = `/${serviceName.replace(/\./g, '/')}`;

if (!usedBus) {
  throw new Error('Could not connect to the DBus session bus.');
}

usedBus.requestName(serviceName, 0x4, (err, retCode) => {
  // If there was an error, warn user and fail
  if (err) {
    throw new Error(
      `Could not request service name ${serviceName}, the error was: ${err}.`
    );
  }

  // Return code 0x1 means we successfully had the name
  if (retCode === 1) {
    console.log(`Successfully requested service name "${serviceName}"!`);
    proceed();
  } else {
    /* Other return codes means various errors, check here
	(https://dbus.freedesktop.org/doc/api/html/group__DBusShared.html#ga37a9bc7c6eb11d212bf8d5e5ff3b50f9) for more
	information
	*/
    throw new Error(
      `Failed to request service name "${serviceName}". Check what return code "${retCode}" means.`
    );
  }
});

async function proceed() {

    // First, we need to create our interface description (here we will only expose method calls)
    const ifaceDesc = {
      name: interfaceName,
      methods: {
      },
      properties: getIfaceDesc(device),
      signals: {
      }
    }

    // Then we need to create the interface implementation (with actual functions)
    const iface = getIface(device)

    iface.CustomName = `Virtual ${device}`
    iface.Status = 0
    iface.Serial = '1234567890'

    // First we use addSettings to claim a deviceInstance
    const settingsResult = await addSettings(usedBus, [
      {
        path: `/Settings/Devices/virtual_${deviceId}/ClassAndVrmInstance`,
        default: `${device}:100`,
        type: 's'
      }
    ])

    // It looks like there are a few posibilities here:
    // 1. We claimed this deviceInstance before, and we get the same one
    // 2. a. The deviceInstance is already taken, and we get a new one
    // 2. b. The deviceInstance is not taken, and we get the one we requested
    const getDeviceInstance = (result) => {
      try {
        const firstValue = result?.[0]?.[2]?.[1]?.[1]?.[0]?.split(':')[1]
        if (firstValue != null) {
          const number = Number(firstValue)
          if (!isNaN(number)) {
            return number
          }
        }
      } catch (e) {
      }

      try {
        const fallbackValue = result?.[1]?.[0]?.split(':')[1]
        if (fallbackValue != null) {
          const number = Number(fallbackValue)
          if (!isNaN(number)) {
            return number
          }
        }
      } catch (e) {
      }

      console.warn('Failed to extract valid DeviceInstance from settings result')
      return null
    }
    iface.DeviceInstance = getDeviceInstance(settingsResult)

  // Now we need to actually export our interface on our object
  usedBus.exportInterface(iface, objectPath, ifaceDesc);

  // Then we can add the required Victron interfaces, and receive some funtions to use
  const {
    getValue,
    emitItemsChanged
  } = addVictronInterfaces(usedBus, ifaceDesc, iface);
  // emitItemsChanged();

  console.log('Interface exposed to DBus, ready to receive function calls!');

  // setInterval(async () => {
 
  //   // // set a random value. By calling emitItemsChanged afterwards, the
  //   // // Victron-specific signal 'ItemsChanged' will be emitted
  //   iface.Soc = Math.round(Math.random() * 100);
  //   emitItemsChanged();

  //   console.log('Battery SOC:', iface.Soc);

  // }, 90000);

}
