'use client';

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/shared/status-badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Bus, MapPin, Users, Gauge, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/app-store';
import { motion } from 'framer-motion';

interface Route {
  id: string;
  name: string;
  driver: string;
  vehicle: string;
  stops: number;
  capacity: number;
  status: string;
}

export function TransportView() {
  const { selectedSchoolId, currentUser } = useAppStore();
  const schoolId = selectedSchoolId || currentUser.schoolId;

  const [open, setOpen] = React.useState(false);
  const [routeName, setRouteName] = React.useState('');
  const [driverName, setDriverName] = React.useState('');
  const [vehicleDetails, setVehicleDetails] = React.useState('');
  const [numStops, setNumStops] = React.useState('');
  const [capacity, setCapacity] = React.useState('');

  const [routes, setRoutes] = useState<Route[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRoutes = useCallback(async () => {
    if (!schoolId) {
      setError('No school selected');
      setIsLoading(false);
      return;
    }
    try {
      setError(null);
      setIsLoading(true);

      // Fetch from school-settings (transport routes stored as JSON in settings)
      const res = await fetch(`/api/school-settings?schoolId=${schoolId}`);
      if (!res.ok) throw new Error('Failed to fetch transport data');
      const json = await res.json();

      if (json.data && json.data.transportRoutes) {
        try {
          const parsed = typeof json.data.transportRoutes === 'string'
            ? JSON.parse(json.data.transportRoutes)
            : json.data.transportRoutes;
          setRoutes(parsed);
        } catch {
          setRoutes([]);
        }
      } else {
        setRoutes([]);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load transport data';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    fetchRoutes();
  }, [fetchRoutes]);

  const handleAddRoute = async () => {
    if (!schoolId || !routeName || !driverName) {
      toast.error('Please fill in route name and driver name');
      return;
    }

    const newRoute: Route = {
      id: `rt-${Date.now()}`,
      name: routeName,
      driver: driverName,
      vehicle: vehicleDetails || 'Not specified',
      stops: parseInt(numStops) || 0,
      capacity: parseInt(capacity) || 0,
      status: 'active',
    };

    const updatedRoutes = [...routes, newRoute];

    try {
      const res = await fetch('/api/school-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId,
          transportRoutes: JSON.stringify(updatedRoutes),
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Failed to save route');
      }

      setRoutes(updatedRoutes);
      setOpen(false);
      setRouteName('');
      setDriverName('');
      setVehicleDetails('');
      setNumStops('');
      setCapacity('');
      toast.success('Route added successfully');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add route');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Transport Management</h2>
            <p className="text-sm text-muted-foreground">Manage school bus routes and schedules</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Transport Management</h2>
            <p className="text-sm text-muted-foreground">Manage school bus routes and schedules</p>
          </div>
        </div>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-red-500 mb-4">{error}</p>
            <Button onClick={fetchRoutes} variant="outline" className="gap-2">
              <Loader2 className="h-4 w-4" /> Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <motion.div 
      className="space-y-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div 
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div>
          <h2 className="text-lg font-semibold">Transport Management</h2>
          <p className="text-sm text-muted-foreground">Manage school bus routes and schedules</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="size-4 mr-2" />Add Route</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Transport Route</DialogTitle>
              <DialogDescription>Create a new school bus route.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="space-y-2">
                <Label>Route Name</Label>
                <Input placeholder="e.g. Ikeja Route" value={routeName} onChange={e => setRouteName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Driver Name</Label>
                <Input placeholder="Enter driver name" value={driverName} onChange={e => setDriverName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Vehicle Details</Label>
                <Input placeholder="Vehicle model and plate number" value={vehicleDetails} onChange={e => setVehicleDetails(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Number of Stops</Label>
                  <Input placeholder="5" type="number" value={numStops} onChange={e => setNumStops(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Capacity</Label>
                  <Input placeholder="18" type="number" value={capacity} onChange={e => setCapacity(e.target.value)} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleAddRoute}>Add Route</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>

      {/* Route Cards */}
      {routes.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center">
            <Bus className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500">No transport routes configured yet.</p>
            <p className="text-xs text-gray-400 mt-1">Click &quot;Add Route&quot; to create your first route.</p>
          </CardContent>
        </Card>
      ) : (
        <motion.div 
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {routes.map((route, idx) => (
            <motion.div
              key={route.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.05 }}
              whileHover={{ scale: 1.02 }}
            >
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                        <Bus className="size-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{route.name}</p>
                        <p className="text-xs text-muted-foreground">{route.vehicle}</p>
                      </div>
                    </div>
                    <StatusBadge variant={route.status === 'active' ? 'success' : 'neutral'} size="sm">
                      {route.status}
                    </StatusBadge>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Driver</span>
                      <span className="font-medium">{route.driver}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="size-3 text-muted-foreground" />
                      <span>{route.stops} stops</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users className="size-3 text-muted-foreground" />
                      <span>{route.capacity} capacity</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}
