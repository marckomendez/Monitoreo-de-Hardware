const si = require('systeminformation');

exports.getHardwareInfo = async (req, res) => {
    try {
        const cpu = await si.cpu();
        const mem = await si.mem();
        const disk = await si.diskLayout();
        res.json({
            cpu,
            ram: mem,
            discos: disk
        });
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener información de hardware', detalle: error.message });
    }
};

exports.getCPUTemp = async (req, res) => {
    try {
        const temp = await si.cpuTemperature();
        res.json(temp);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener temperatura de CPU', detalle: error.message });
    }
};

exports.getUptime = async (req, res) => {
    try {
        const time = await si.time();
        res.json({ uptime: time.uptime });
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener tiempo de actividad', detalle: error.message });
    }
};

exports.getDiskSpeed = async (req, res) => {
    try {
        const diskIO = await si.disksIO();
        // Convertir a MB/s
        res.json({ read: (diskIO.rIO_sec / 1024).toFixed(2), write: (diskIO.wIO_sec / 1024).toFixed(2) });
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener velocidad de disco', detalle: error.message });
    }
};
